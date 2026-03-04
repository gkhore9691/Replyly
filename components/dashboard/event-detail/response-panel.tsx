import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonView } from "@/components/ui/json-view";

interface ResponsePanelProps {
  event: {
    statusCode?: number;
    fullPayload?: {
      responseBody?: unknown;
    };
  };
}

export function ResponsePanel({ event }: ResponsePanelProps) {
  const payload = event.fullPayload ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Response</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="body">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="body">Body</TabsTrigger>
          </TabsList>
          <TabsContent value="body" className="mt-4">
            <JsonView data={payload.responseBody} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
