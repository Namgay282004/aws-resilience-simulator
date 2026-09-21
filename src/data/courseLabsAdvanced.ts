import type { CourseLab, LabReference, LabConfigurationCheck } from './courseLabShared.ts';
import { node, edge, scenario, root } from './courseLabShared.ts';
import type { Principal } from '../engine/iam/types.ts';

const sources = {
  edge: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-edge-function-restrictions.html',
  notification: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html',
  pipeline: 'https://docs.aws.amazon.com/codepipeline/latest/userguide/action-reference-S3.html',
  build: 'https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html',
  deploy: 'https://docs.aws.amazon.com/codepipeline/latest/userguide/file-reference.html',
  monitoring: root + 'Lab-13-monitoring.html'
};
const check = (id: string, nodeId: string, field: string, expected: unknown, reason: string, source: string): LabConfigurationCheck =>
  ({ id, nodeId, path: ['customConfig', ...field.split('.')], operator: 'equals', expected, reason, source });
const connection = (sourceId: string, targetId: string, source: string): LabConfigurationCheck => ({
  id: `${sourceId}-${targetId}-relationship`, nodeId: sourceId, otherNodeId: targetId, path: [], operator: 'connection',
  reason: `The reference must retain the ${sourceId} → ${targetId} relationship.`, source
});
// Dashed relationships describe configuration, telemetry or artifacts. They never
// become an invented HTTP forwarding path through a build/monitoring service.
const relationship = (source: string, target: string, label: string) => ({
  ...edge(source, target, 'HTTPS', true), style: { strokeDasharray: '6 4' },
  data: { ...edge(source, target, 'HTTPS', true).data!, label, isCriticalDependency: false }
});
function variant(base: LabReference, id: string, title: string, expected: string, mutate: (ref: LabReference) => void): LabReference {
  const ref = structuredClone(base);
  ref.id = id; ref.scenario.id = id; ref.scenario.name = title; ref.title = title; ref.expected = expected;
  mutate(ref);
  return ref;
}
const config = (ref: LabReference, id: string) => ref.nodes.find(n => n.id === id)!.data.customConfig!;

function securityReferences(alb: LabReference): LabReference[] {
  const network = variant(alb, 'lab9-network', 'ALB-only task access', 'SUCCESS through the ALB; direct web-to-task access is denied.', ref => {
    ref.nodes.find(n => n.id === 'lab-alb-sg')!.data.securityGroupRules = {
      inbound: [{ protocol: 'HTTP', portRange: '80', source: { type: 'cidr', cidr: '0.0.0.0/0' } }],
      outbound: [{ protocol: 'HTTP', portRange: '80', source: { type: 'securityGroup', securityGroupId: 'lab-task-sg' } }]
    };
    ref.nodes.find(n => n.id === 'lab-task-sg')!.data.securityGroupRules = {
      inbound: [{ protocol: 'HTTP', portRange: '80', source: { type: 'securityGroup', securityGroupId: 'lab-alb-sg' } }],
      outbound: [{ protocol: 'HTTPS', portRange: '443', source: { type: 'cidr', cidr: '0.0.0.0/0' } }]
    };
    ref.nodes.find(n => n.id === 'lab-web')!.data.notes = 'Lab 9 baseline: IMDSv2 required, hop limit 1; metadata enforcement and SSH/bastion exercises are not executed.';
  });
  network.simulationScope = 'Supported ALB/task network checks only. Prefix-list egress, credential rotation, IMDSv2 and the complete security audit are not executed.';
  const blocked = variant(network, 'lab9-direct-denied', 'Web tier cannot bypass the ALB', 'DENIED by the task security group.', ref => {
    ref.edges.push(edge('lab-web', 'lab-task-a'));
    ref.scenario.startNodeId = 'lab-web';
  });
  const reader: Principal = { id: 'usms-transcripts-reader-role', kind: 'role', accountId: '000000000000', identityPolicies: [{
    id: 'USMSStudentDataReadOnly', kind: 'identity', statements: [
      { effect: 'Allow', actions: ['s3:GetObject'], resources: ['arn:aws:s3:::usms-student-data/*'] },
      { effect: 'Allow', actions: ['s3:ListBucket'], resources: ['arn:aws:s3:::usms-student-data'] }
    ]
  }] };
  const read: LabReference = {
    id: 'lab9-reader', title: 'Read-only transcript role', description: 'Evaluate the effective role policy against a future transcript object. The bucket is created in Lab 10.',
    expected: 'ALLOW GetObject; policy evidence does not prove that the bucket exists.',
    nodes: [node('lab-user', 'iam', reader.id, 40, 160), node('lab-bucket', 's3', 'Future usms-student-data resource', 400, 160)],
    edges: [edge('lab-user', 'lab-bucket', 'Object access')], scenario: scenario('lab9-reader', 'lab-user'),
    authorization: { principal: reader, action: 's3:GetObject', resourceArn: 'arn:aws:s3:::usms-student-data/transcripts/student.json' }
  };
  const write = variant(read, 'lab9-write-denied', 'Read-only role cannot upload', 'DENY PutObject through implicit deny.', ref => { ref.authorization!.action = 's3:PutObject'; });
  return [network, blocked, read, write];
}

function lambdaReference(): LabReference {
  const nodes = [
    node('lab-viewer', 'user', 'Student browser', 40, 220),
    node('lab-cdn', 'cloudfront', 'usms-transcript-cdn', 300, 220, { notes: 'Viewer-request runs before cache lookup; origin-response runs after an origin reply. Associations are configuration only.' }),
    node('lab-edge-viewer', 'lambda', 'usms-edge-viewer-request', 300, 20, { customConfig: { region: 'us-east-1', version: '1', architecture: 'x86_64', environment: {}, vpcAttached: false, trigger: 'viewer-request', trustPrincipals: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'] } }),
    node('lab-bucket', 's3', 'usms-student-data', 580, 220, { customConfig: { region: 'us-east-1', blockPublicAccess: true, notification: { event: 's3:ObjectCreated:*', prefix: 'transcripts/', suffix: '.json', target: 'usms-transcript-notifier:live' } }, notes: 'Private S3 origin. CloudFront origin access authorization is outside these bounded checks.' }),
    node('lab-edge-response', 'lambda', 'usms-edge-origin-response', 580, 20, { customConfig: { region: 'us-east-1', version: '1', architecture: 'x86_64', environment: {}, vpcAttached: false, trigger: 'origin-response', trustPrincipals: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'] } }),
    node('lab-notifier', 'lambda', 'usms-transcript-notifier:live', 860, 220, { customConfig: { region: 'us-east-1', alias: 'live', executionRole: 'usms-lambda-exec-role' }, notes: 'Separate regional S3-triggered function. Invocation resource policy and handler execution are not evaluated here.' }),
    node('lab-notifier-logs', 'cloudwatch', '/aws/lambda/usms-transcript-notifier', 1140, 220),
    node('lab-lambda-role', 'iam', 'Lambda execution roles', 860, 20, { notes: 'Edge trust: lambda.amazonaws.com + edgelambda.amazonaws.com. Regional notifier uses usms-lambda-exec-role. Roles do not grant S3 permission to invoke the function.' })
  ];
  const edges = [relationship('lab-viewer', 'lab-cdn', 'Viewer request'), relationship('lab-cdn', 'lab-edge-viewer', 'viewer-request association'),
    relationship('lab-cdn', 'lab-bucket', 'Private origin'), relationship('lab-cdn', 'lab-edge-response', 'origin-response association'),
    relationship('lab-bucket', 'lab-notifier', 'ObjectCreated · transcripts/*.json'), relationship('lab-notifier', 'lab-notifier-logs', 'Regional logs'), relationship('lab-lambda-role', 'lab-notifier', 'Execution role')];
  const checks: LabConfigurationCheck[] = [];
  for (const id of ['lab-edge-viewer', 'lab-edge-response']) {
    checks.push(check(`${id}-region`, id, 'region', 'us-east-1', 'Lambda@Edge functions must be in us-east-1.', sources.edge),
      { ...check(`${id}-version`, id, 'version', undefined, 'Lambda@Edge requires a numbered version, not $LATEST or an alias.', sources.edge), operator: 'numberedVersion' },
      check(`${id}-vpc`, id, 'vpcAttached', false, 'Lambda@Edge cannot use a VPC attachment.', sources.edge),
      check(`${id}-environment`, id, 'environment', {}, 'Lambda@Edge does not support user environment variables.', sources.edge),
      check(`${id}-architecture`, id, 'architecture', 'x86_64', 'Lambda@Edge does not support arm64.', sources.edge));
    for (const principal of ['lambda.amazonaws.com', 'edgelambda.amazonaws.com']) checks.push({ ...check(`${id}-${principal}`, id, 'trustPrincipals', principal, `Edge role trust must include ${principal}; this checks declared principals, not full IAM authorization.`, sources.edge), operator: 'includes' });
  }
  checks.push({ ...check('notification-region', 'lab-notifier', 'region', undefined, 'S3 and its Lambda notification destination must share a Region.', sources.notification), otherNodeId: 'lab-bucket', otherPath: ['customConfig', 'region'] },
    check('notification-target', 'lab-bucket', 'notification.target', 'usms-transcript-notifier:live', 'Course notification targets the regional live alias.', root + 'Lab-10-lambda.html'),
    check('notification-event', 'lab-bucket', 'notification.event', 's3:ObjectCreated:*', 'Course uploads trigger ObjectCreated notifications.', sources.notification),
    check('notification-prefix', 'lab-bucket', 'notification.prefix', 'transcripts/', 'Course notification is restricted to transcript keys.', root + 'Lab-10-lambda.html'),
    check('notification-suffix', 'lab-bucket', 'notification.suffix', '.json', 'Course notification is restricted to JSON objects.', root + 'Lab-10-lambda.html'));
  checks.push(...edges.map(e => connection(e.source, e.target, root + 'Lab-10-lambda.html')));
  return { id: 'lab10-config', title: 'Edge and regional Lambda configuration', description: 'Inspect two edge associations and the separate S3 → regional notifier path.',
    expected: 'PASS the listed configuration checks; no function code is executed.', nodes, edges, scenario: scenario('lab10-config', 'lab-cdn'), configurationChecks: checks,
    simulationScope: 'Partial configuration validation only. No authentication handler, cache, OAC/bucket policy, invocation permission, event delivery or logging is executed.' };
}

function pipelineReference(deploy: boolean): LabReference {
  const id = deploy ? 'lab12-config' : 'lab11-config';
  const nodes = [
    node('lab-source', 's3', 'usms-pipeline-artifacts', 40, 220, { customConfig: { versioning: true, region: 'us-east-1', sourceKey: 'source/usms-enrolment-src.zip' }, notes: 'One versioned bucket holds the source ZIP and SourceOutput/BuildOutput artifacts.' }),
    node('lab-pipeline', 'codepipeline', 'usms-enrolment-pipeline', 300, 220, { customConfig: { region: 'us-east-1', stages: deploy ? ['Source', 'Build', 'Deploy'] : ['Source', 'Build'], serviceRole: 'usms-codepipeline-role' } }),
    node('lab-build', 'codebuild', 'usms-enrolment-build', 580, 220, { customConfig: { sourceType: 'CODEPIPELINE', artifactType: 'CODEPIPELINE', buildspec: 'buildspec.yml', serviceRole: 'usms-codebuild-role', containerName: 'enrolment-api', imageDefinitions: [{ name: 'enrolment-api', imageUri: '000000000000.dkr.ecr.us-east-1.amazonaws.com/usms-enrolment:r7' }] } }),
    node('lab-pipeline-role', 'iam', 'usms-codepipeline-role', 300, 20),
    node('lab-build-role', 'iam', 'usms-codebuild-role', 580, 20),
    node('lab-build-logs', 'cloudwatch', '/aws/codebuild/usms-enrolment-build', 580, 440)
  ];
  const edges = [relationship('lab-source', 'lab-pipeline', 'Versioned source ZIP'), relationship('lab-pipeline', 'lab-build', 'SourceOutput → Build'),
    relationship('lab-build', 'lab-source', 'BuildOutput in artifact store'), relationship('lab-pipeline-role', 'lab-pipeline', 'Service role'),
    relationship('lab-build-role', 'lab-build', 'Build role'), relationship('lab-build', 'lab-build-logs', 'Build logs')];
  const checks = [check('source-versioning', 'lab-source', 'versioning', true, 'An S3 pipeline source requires bucket versioning.', sources.pipeline),
    check('source-key', 'lab-source', 'sourceKey', 'source/usms-enrolment-src.zip', 'The course pipeline reads the enrolment source archive.', root + 'Lab-11-pipeline.html'),
    check('buildspec', 'lab-build', 'buildspec', 'buildspec.yml', 'The course uses buildspec.yml at the source root.', sources.build),
    check('build-input', 'lab-build', 'sourceType', 'CODEPIPELINE', 'The course CodeBuild project receives pipeline artifacts.', root + 'Lab-11-pipeline.html'),
    check('build-output', 'lab-build', 'artifactType', 'CODEPIPELINE', 'The course build returns its artifact to CodePipeline.', root + 'Lab-11-pipeline.html'),
    check('stages', 'lab-pipeline', 'stages', deploy ? ['Source', 'Build', 'Deploy'] : ['Source', 'Build'], 'Course stages must retain their declared order.', root + (deploy ? 'Lab-12-ECSpipeline.html' : 'Lab-11-pipeline.html'))];
  if (deploy) {
    nodes.push(node('lab-registry', 'ecr_registry', 'ECR · usms-enrolment', 860, 20),
      node('lab-deploy', 'codepipeline', 'ECS standard deploy action', 860, 220, { customConfig: { fileName: 'imagedefinitions.json', containerName: 'enrolment-api', cluster: 'usms-ecs-cluster', service: 'usms-enrolment-svc' }, notes: 'Action inside the same pipeline; not a second pipeline. Registers a task revision and updates the service on AWS; not executed here.' }),
      node('lab-execution-role', 'iam', 'usms-ecs-exec-role', 860, 440, { notes: 'Execution role pulls ECR images; the task role authorizes application API calls.' }));
    edges.push(relationship('lab-build', 'lab-registry', 'Build and push image'), relationship('lab-build', 'lab-deploy', 'BuildOutput / imagedefinitions.json'), relationship('lab-execution-role', 'lab-registry', 'Image pull permissions'));
    checks.push(check('image-file', 'lab-deploy', 'fileName', 'imagedefinitions.json', 'The course standard ECS deploy action reads imagedefinitions.json.', sources.deploy),
      { ...check('container-match', 'lab-build', 'imageDefinitions.0.name', undefined, 'Image definition name must match the ECS task container name.', sources.deploy), otherNodeId: 'lab-task-a', otherPath: ['customConfig', 'ecs', 'containerName'] },
      check('image-uri', 'lab-build', 'imageDefinitions.0.imageUri', '000000000000.dkr.ecr.us-east-1.amazonaws.com/usms-enrolment:r7', 'This supplied release snapshot deploys the r7 ECR image; tags can move, digests identify immutable content.', root + 'Lab-12-ECSpipeline.html'));
  }
  checks.push(...edges.map(e => connection(e.source, e.target, root + (deploy ? 'Lab-12-ECSpipeline.html' : 'Lab-11-pipeline.html'))));
  return { id, title: deploy ? 'ECS deployment artifact contract' : 'Source and build artifact contract', description: 'Follow source, build artifacts, service roles and the supplied release configuration.',
    expected: 'PASS the listed configuration checks; no build or deployment is executed.', nodes, edges, scenario: scenario(id, 'lab-pipeline'), configurationChecks: checks,
    simulationScope: 'Partial configuration checks only. IAM service-role authorization, buildspec commands, Docker/ECR operations, task revision registration and rollback are not executed.' };
}

function monitoringReference(): LabReference {
  const nodes = [
    node('lab-notifier', 'lambda', 'usms-transcript-notifier:live · v2', 40, 220, { customConfig: { tracing: 'Active' } }),
    node('lab-central-logs', 'cloudwatch', '/usms/central/application', 300, 20, { customConfig: { retentionInDays: 30, filterPattern: 'ERROR' } }),
    node('lab-notifier-logs', 'cloudwatch', '/aws/lambda/usms-transcript-notifier', 300, 220, { customConfig: { retentionInDays: 14, filterPattern: 'USMS_NOTIFY' } }),
    node('lab-ecs-logs', 'cloudwatch', '/usms/ecs/enrolment', 300, 440, { customConfig: { retentionInDays: 30 } }),
    node('lab-metrics', 'cloudwatch', 'USMS/Application metrics', 580, 220, { notes: 'CentralErrorCount / NotifyCount from filters; TranscriptsProcessed, TranscriptLagSeconds, EdgeDenyCount from application metrics. Dimensions are part of metric identity.' }),
    node('lab-lag-alarm', 'cloudwatch', 'usms-transcript-lag-high', 860, 20),
    node('lab-silence-alarm', 'cloudwatch', 'usms-notify-silence', 860, 220, { customConfig: { metricName: 'NotifyCount', treatMissingData: 'breaching' } }),
    node('lab-dashboard', 'cloudwatch', 'usms-overview · dashboard', 860, 440),
    node('lab-composite', 'cloudwatch', 'usms-transcript-pipeline-down', 1140, 120, { customConfig: { alarmRule: 'ALARM("usms-transcript-lag-high") OR ALARM("usms-notify-silence")', alarmActions: [] }, notes: 'SNS alarm actions belong to a future lab; no notification is sent.' }),
    node('lab-xray', 'xray', 'X-Ray · usms-transcripts-sampling', 40, 440, { notes: 'Trace/segment/subsegment relationships are reference metadata. No trace ingestion, sampling or request timing is executed.' }),
    node('lab-observability-role', 'iam', 'USMSObservabilityWrite', 40, 20, { notes: 'Logs, custom metrics and X-Ray write policy; attachment is reference metadata, not proof of authorization.' })
  ];
  const edges = [relationship('lab-notifier', 'lab-notifier-logs', 'Function logs'), relationship('lab-notifier', 'lab-xray', 'Tracing'),
    relationship('lab-central-logs', 'lab-metrics', 'ERROR → CentralErrorCount'), relationship('lab-notifier-logs', 'lab-metrics', 'USMS_NOTIFY → NotifyCount'),
    relationship('lab-metrics', 'lab-lag-alarm', 'TranscriptLagSeconds'), relationship('lab-metrics', 'lab-silence-alarm', 'NotifyCount'),
    relationship('lab-metrics', 'lab-dashboard', 'Dashboard widgets'), relationship('lab-lag-alarm', 'lab-composite', 'ALARM(a)'), relationship('lab-silence-alarm', 'lab-composite', 'OR ALARM(b)'),
    relationship('lab-observability-role', 'lab-notifier', 'Telemetry write policy')];
  const checks = [check('central-retention', 'lab-central-logs', 'retentionInDays', 30, 'Course central log retention is 30 days.', sources.monitoring),
    check('ecs-retention', 'lab-ecs-logs', 'retentionInDays', 30, 'Course ECS log retention is 30 days.', sources.monitoring),
    check('notifier-retention', 'lab-notifier-logs', 'retentionInDays', 14, 'Course notifier log retention is 14 days.', sources.monitoring),
    check('notify-filter', 'lab-notifier-logs', 'filterPattern', 'USMS_NOTIFY', 'Course notifier filter counts USMS_NOTIFY log lines.', sources.monitoring),
    check('missing-data', 'lab-silence-alarm', 'treatMissingData', 'breaching', 'Course silence detection must treat missing data as breaching.', sources.monitoring),
    check('active-tracing', 'lab-notifier', 'tracing', 'Active', 'Course regional notifier enables active tracing; Lambda@Edge is a separate path.', sources.monitoring),
    check('composite-rule', 'lab-composite', 'alarmRule', 'ALARM("usms-transcript-lag-high") OR ALARM("usms-notify-silence")', 'Course composite alarm combines lag OR silence.', sources.monitoring),
    check('future-alerting', 'lab-composite', 'alarmActions', [], 'Lab 13 records an alerting draft; it does not attach SNS actions.', sources.monitoring),
    ...edges.map(e => connection(e.source, e.target, sources.monitoring))];
  return { id: 'lab13-config', title: 'Logs, metrics, alarms and tracing', description: 'Inspect the three telemetry layers and check the course retention, silence-detection and tracing configuration.',
    expected: 'PASS the listed configuration checks; no telemetry or alarm state transition is executed.', nodes, edges, configurationChecks: checks, scenario: scenario('lab13-config', 'lab-notifier'),
    simulationScope: 'Configuration evidence only. No log ingestion, metric filtering, time-series evaluation, composite alarm transition, dashboard rendering, X-Ray ingestion or SNS delivery is executed.' };
}

export function createAdvancedCourseLabs(alb: LabReference): CourseLab[] {
  const lambda = lambdaReference(), pipeline = pipelineReference(false), deployment = pipelineReference(true), monitoring = monitoringReference();
  // Keep the deploy contract visibly connected to its real runtime topology.
  // Pipeline resources occupy the upper band; the unchanged subnet layout sits below.
  const deployedNetwork = structuredClone(alb);
  deployedNetwork.nodes.forEach(n => {
    n.position.y += 700;
    if (n.data.serviceId === 'ecs') {
      n.data.customConfig!.ecs.containerName = 'enrolment-api';
      n.data.notes = 'ECS task definition container enrolment-api; service usms-enrolment-svc. The pipeline changes its image, not its other task settings.';
    }
  });
  deployment.nodes.push(...deployedNetwork.nodes);
  deployment.edges.push(...deployedNetwork.edges,
    relationship('lab-deploy', 'lab-task-a', 'Update ECS service'),
    relationship('lab-deploy', 'lab-task-b', 'Update ECS service'));
  deployment.configurationChecks!.push(connection('lab-deploy', 'lab-task-a', sources.deploy), connection('lab-deploy', 'lab-task-b', sources.deploy));
  const runtime = variant(alb, 'lab12-runtime', 'Supplied deployed service snapshot', 'SUCCESS through ALB to a running task; no deployment was performed.', ref => {
    ref.nodes.filter(n => n.data.serviceId === 'ecs').forEach(n => { n.data.notes = 'Supplied release r7; image in ECR usms-enrolment. This request checks the running snapshot, not pipeline deployment.'; });
  });
  runtime.simulationScope = 'ALB/ECS request against a supplied running release. Image pull, deployment, circuit breaker and rollback are not executed.';
  return [
    { id: 'dso303-9', number: 9, title: 'Security review', sourceUrl: root + 'Lab-09-security.html', objectives: ['Separate IAM permissions from network reachability.', 'Verify read-only access and ALB-only task ingress.'], limitations: 'Selected IAM and SG checks only. Trust conditions, PassRole, boundaries, session policies, IMDSv2, key rotation and complete egress audit remain in the original exercise.', references: securityReferences(alb) },
    { id: 'dso303-10', number: 10, title: 'Lambda and edge functions', sourceUrl: root + 'Lab-10-lambda.html', objectives: ['Distinguish edge associations from regional S3 event processing.', 'Check region, published versions, edge restrictions and notification configuration.'], limitations: lambda.simulationScope!, references: [lambda, variant(lambda, 'lab10-latest-invalid', '$LATEST is invalid at the edge', 'FAIL the numbered-version check.', ref => { config(ref, 'lab-edge-viewer').version = '$LATEST'; })] },
    { id: 'dso303-11', number: 11, title: 'CI/CD source and build', sourceUrl: root + 'Lab-11-pipeline.html', objectives: ['Locate source and build artifacts in the versioned S3 store.', 'Distinguish pipeline and CodeBuild roles and stages.'], limitations: pipeline.simulationScope!, references: [pipeline, variant(pipeline, 'lab11-versioning-invalid', 'Source bucket versioning disabled', 'FAIL the source-versioning check.', ref => { config(ref, 'lab-source').versioning = false; })] },
    { id: 'dso303-12', number: 12, title: 'ECS pipeline deployment', sourceUrl: root + 'Lab-12-ECSpipeline.html', objectives: ['Connect build artifacts, ECR images and the ECS deploy action.', 'Detect a container-name mismatch and test a supplied running service.'], limitations: deployment.simulationScope!, references: [deployment, variant(deployment, 'lab12-container-invalid', 'Image definition names the wrong container', 'FAIL the container-name check.', ref => { config(ref, 'lab-build').imageDefinitions[0].name = 'wrong-container'; }), runtime] },
    { id: 'dso303-13', number: 13, title: 'CloudWatch and X-Ray monitoring', sourceUrl: root + 'Lab-13-monitoring.html', objectives: ['Separate logs, metrics, alarms, dashboards and traces.', 'Check retention and missing-data configuration without implying alert delivery.'], limitations: monitoring.simulationScope!, references: [monitoring, variant(monitoring, 'lab13-silence-invalid', 'Silence alarm ignores missing data', 'FAIL the course silence-detection check.', ref => { config(ref, 'lab-silence-alarm').treatMissingData = 'notBreaching'; })] }
  ];
}
