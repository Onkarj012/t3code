import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { ChatAttachment, ModelSelection, ProviderInstanceId } from "@t3tools/contracts";
import { TextGenerationError } from "@t3tools/contracts";

import * as ProviderInstanceRegistry from "../provider/Services/ProviderInstanceRegistry.ts";
import type { ProviderInstance } from "../provider/ProviderDriver.ts";
import * as SourceControlProviderRegistry from "../sourceControl/SourceControlProviderRegistry.ts";
import * as ThreadTitleLinks from "./ThreadTitleLinks.ts";
import type { TextGenerationPolicy } from "./TextGenerationPolicy.ts";

export interface CommitMessageGenerationInput {
  cwd: string;
  branch: string | null;
  stagedSummary: string;
  stagedPatch: string;
  /** When true, the model also returns a semantic branch name for the change. */
  includeBranch?: boolean;
  policy?: TextGenerationPolicy | undefined;
  /** What model and provider to use for generation. */
  modelSelection: ModelSelection;
  /** Tried once when `modelSelection` fails. Absent means no fallback. */
  fallbackModelSelection?: ModelSelection | undefined;
}

export interface CommitMessageGenerationResult {
  subject: string;
  body: string;
  /** Only present when `includeBranch` was set on the input. */
  branch?: string | undefined;
}

export interface PrContentGenerationInput {
  cwd: string;
  baseBranch: string;
  headBranch: string;
  commitSummary: string;
  diffSummary: string;
  diffPatch: string;
  changeRequestTemplate?: string | undefined;
  policy?: TextGenerationPolicy | undefined;
  /** What model and provider to use for generation. */
  modelSelection: ModelSelection;
  /** Tried once when `modelSelection` fails. Absent means no fallback. */
  fallbackModelSelection?: ModelSelection | undefined;
}

export interface PrContentGenerationResult {
  title: string;
  body: string;
}

export interface BranchNameGenerationInput {
  cwd: string;
  message: string;
  attachments?: ReadonlyArray<ChatAttachment> | undefined;
  /** What model and provider to use for generation. */
  modelSelection: ModelSelection;
  /** Tried once when `modelSelection` fails. Absent means no fallback. */
  fallbackModelSelection?: ModelSelection | undefined;
}

export interface BranchNameGenerationResult {
  branch: string;
}

export interface ThreadTitleGenerationInput {
  linkedContext?: string | undefined;
  cwd: string;
  message: string;
  /** Present when replacing an existing title from the current thread history. */
  previousTitle?: string | undefined;
  attachments?: ReadonlyArray<ChatAttachment> | undefined;
  /** What model and provider to use for generation. */
  modelSelection: ModelSelection;
  /** Tried once when `modelSelection` fails. Absent means no fallback. */
  fallbackModelSelection?: ModelSelection | undefined;
}

export interface ThreadTitleGenerationResult {
  title: string;
  needsRefinement?: boolean | undefined;
}

/**
 * TextGeneration - Service tag for commit and change request text generation.
 */
export class TextGeneration extends Context.Service<
  TextGeneration,
  {
    /**
     * Generate a commit message from staged change context.
     */
    readonly generateCommitMessage: (
      input: CommitMessageGenerationInput,
    ) => Effect.Effect<CommitMessageGenerationResult, TextGenerationError>;

    /**
     * Generate change request title/body from branch and diff context.
     */
    readonly generatePrContent: (
      input: PrContentGenerationInput,
    ) => Effect.Effect<PrContentGenerationResult, TextGenerationError>;

    /**
     * Generate a concise branch name from a user message.
     */
    readonly generateBranchName: (
      input: BranchNameGenerationInput,
    ) => Effect.Effect<BranchNameGenerationResult, TextGenerationError>;

    /** Generate a concise thread title from a first message or thread history. */
    readonly generateThreadTitle: (
      input: ThreadTitleGenerationInput,
    ) => Effect.Effect<ThreadTitleGenerationResult, TextGenerationError>;
  }
>()("t3/textGeneration/TextGeneration") {}

type TextGenerationOp =
  | "generateCommitMessage"
  | "generatePrContent"
  | "generateBranchName"
  | "generateThreadTitle";

const resolveInstance = (
  registry: ProviderInstanceRegistry.ProviderInstanceRegistry["Service"],
  operation: TextGenerationOp,
  instanceId: ProviderInstanceId,
): Effect.Effect<ProviderInstance["textGeneration"], TextGenerationError> =>
  registry.getInstance(instanceId).pipe(
    Effect.flatMap((instance) =>
      instance
        ? Effect.succeed(instance.textGeneration)
        : Effect.fail(
            new TextGenerationError({
              operation,
              detail: `No provider instance registered for id '${instanceId}'.`,
            }),
          ),
    ),
  );

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.gen(function* () {
  const registry = yield* ProviderInstanceRegistry.ProviderInstanceRegistry;
  const sourceControl = yield* SourceControlProviderRegistry.SourceControlProviderRegistry;

  /**
   * Runs `run` against the primary model, then once more against the fallback
   * if the primary fails for any reason. A fallback that resolves to the same
   * instance and model as the primary is ignored, as is an absent one, so
   * callers that pass nothing behave exactly as they did without a fallback.
   */
  const runWithFallback = <A>(
    operation: TextGenerationOp,
    input: {
      readonly modelSelection: ModelSelection;
      readonly fallbackModelSelection?: ModelSelection | undefined;
    },
    run: (
      textGeneration: ProviderInstance["textGeneration"],
      modelSelection: ModelSelection,
    ) => Effect.Effect<A, TextGenerationError>,
  ): Effect.Effect<A, TextGenerationError> => {
    const primary = input.modelSelection;
    const attempt = (selection: ModelSelection) =>
      resolveInstance(registry, operation, selection.instanceId).pipe(
        Effect.flatMap((textGeneration) => run(textGeneration, selection)),
      );

    const fallback = input.fallbackModelSelection;
    if (
      !fallback ||
      (fallback.instanceId === primary.instanceId && fallback.model === primary.model)
    ) {
      return attempt(primary);
    }

    return attempt(primary).pipe(
      Effect.catch((error) =>
        Effect.logWarning("text generation primary model failed, trying fallback", {
          operation,
          primaryInstanceId: primary.instanceId,
          primaryModel: primary.model,
          fallbackInstanceId: fallback.instanceId,
          fallbackModel: fallback.model,
          detail: error.detail,
        }).pipe(Effect.flatMap(() => attempt(fallback))),
      ),
    );
  };

  return TextGeneration.of({
    generateCommitMessage: (input) =>
      runWithFallback("generateCommitMessage", input, (textGeneration, modelSelection) =>
        textGeneration.generateCommitMessage({ ...input, modelSelection }),
      ),
    generatePrContent: (input) =>
      runWithFallback("generatePrContent", input, (textGeneration, modelSelection) =>
        textGeneration.generatePrContent({ ...input, modelSelection }),
      ),
    generateBranchName: (input) =>
      runWithFallback("generateBranchName", input, (textGeneration, modelSelection) =>
        textGeneration.generateBranchName({ ...input, modelSelection }),
      ),
    generateThreadTitle: (input) =>
      Effect.gen(function* () {
        // Resolved once so the fallback attempt does not redo the
        // source-control lookup.
        const linkedContext =
          input.linkedContext ??
          (yield* ThreadTitleLinks.resolveThreadTitleLinks(input).pipe(
            Effect.provideService(
              SourceControlProviderRegistry.SourceControlProviderRegistry,
              sourceControl,
            ),
          ));
        return yield* runWithFallback(
          "generateThreadTitle",
          input,
          (textGeneration, modelSelection) =>
            textGeneration.generateThreadTitle({ ...input, linkedContext, modelSelection }),
        );
      }),
  });
});

export const layer = Layer.effect(TextGeneration, make);
