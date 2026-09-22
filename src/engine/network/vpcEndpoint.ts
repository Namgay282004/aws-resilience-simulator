/** Shared endpoint semantics. Service IDs are simulator catalog IDs, not AWS DNS names.
 * Source: https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html
 * Interface service availability/region, DNS and route associations remain separate concerns.
 */
export interface EndpointSnapshot {
  serviceId: string;
  health?: string;
  customConfig?: Record<string, unknown>;
}
export type EndpointDecision = { allowed: boolean; reason: string };
export function isVpcEndpoint(node: EndpointSnapshot): boolean {
  return node.serviceId === 's3_gateway_endpoint' || node.serviceId === 'privatelink';
}
export function endpointService(node: EndpointSnapshot): string | undefined {
  const configured = node.customConfig?.endpointService;
  if (configured !== undefined) return typeof configured === 'string' && configured.trim() ? configured.trim() : undefined;
  // Preserve the explicit S3 meaning of existing saved diagrams.
  return node.serviceId === 's3_gateway_endpoint' ? 's3' : undefined;
}
export function validateEndpoint(node: EndpointSnapshot): string[] {
  if (!isVpcEndpoint(node)) return ['Resource is not a VPC endpoint.'];
  const service = endpointService(node);
  if (!service) return ['Configure endpointService with the destination service ID.'];
  if (node.serviceId === 's3_gateway_endpoint' && !['s3', 'dynamodb'].includes(service)) {
    return ['Gateway endpoints support only S3 or DynamoDB.'];
  }
  return [];
}
export function evaluateEndpoint(node: EndpointSnapshot, destinationService: string): EndpointDecision {
  const issues = validateEndpoint(node);
  if (issues.length) return { allowed: false, reason: issues.join(' ') };
  if (node.health === 'failed') return { allowed: false, reason: 'VPC endpoint is unavailable.' };
  const service = endpointService(node);
  if (service !== destinationService) return { allowed: false, reason: `Endpoint targets ${service}, not ${destinationService}.` };
  return { allowed: true, reason: `Endpoint service matches ${service}. Route association, DNS and policy authorization must be evaluated separately.` };
}
