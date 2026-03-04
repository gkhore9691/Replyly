import type { ReplaylyClient } from "../../core/client";

type GraphQLResolveInfo = {
  fieldName: string;
  parentType: { name: string };
  returnType: { toString: () => string };
  operation: { operation: string; name?: { value: string } };
  variableValues?: Record<string, unknown>;
};

/**
 * Create an Apollo Server plugin that records GraphQL resolver execution in the Replayly context.
 * Use with ApolloServer({ plugins: [createGraphQLPlugin(client)] }).
 */
export function createGraphQLPlugin(client: ReplaylyClient): {
  requestDidStart(): {
    executionDidStart(): {
      willResolveField?(args: { info: GraphQLResolveInfo }): (error?: Error) => void;
    };
  };
} {
  return {
    requestDidStart() {
      return {
        executionDidStart() {
          return {
            willResolveField({ info }: { info: GraphQLResolveInfo }) {
              const context = client.getContext();
              if (!context) return () => {};

              const operation: Record<string, unknown> = {
                type: "graphql",
                operationType: info.operation.operation,
                operationName: info.operation.name?.value,
                fieldName: info.fieldName,
                parentType: info.parentType.name,
                returnType: typeof info.returnType.toString === "function" ? info.returnType.toString() : String(info.returnType),
                args: info.variableValues,
                startTime: Date.now(),
                durationMs: 0,
              };

              if (!context.operationList) context.operationList = [];

              return (error?: Error) => {
                operation.durationMs = Date.now() - (operation.startTime as number);
                if (error) {
                  operation.error = { message: error.message, stack: error.stack };
                }
                context.operationList!.push(operation);
              };
            },
          };
        },
      };
    },
  };
}
