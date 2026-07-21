export interface AgentModelProvider {
  id: string;
  label: string;
  defaultModel: string;
  apiKeyLabel: string;
  createInteraction(apiKey: string, body: any): Promise<any>;
  emptyResponseMessage: string;
  errorResponseMessage(error: any): string;
}
