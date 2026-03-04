import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonView } from "@/components/ui/json-view";

interface RequestPanelProps {
  event: {
    fullPayload?: {
      body?: unknown;
      headers?: unknown;
      query?: unknown;
    };
  };
}

export function RequestPanel({ event }: RequestPanelProps) {
  const payload = event.fullPayload ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="body">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger value="headers">Headers</TabsTrigger>
            <TabsTrigger value="query">Query</TabsTrigger>
          </TabsList>
          <TabsContent value="body" className="mt-4">
            <JsonView data={payload.body} />
          </TabsContent>
          <TabsContent value="headers" className="mt-4">
            <JsonView data={payload.headers} />
          </TabsContent>
          <TabsContent value="query" className="mt-4">
            <JsonView data={payload.query} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
