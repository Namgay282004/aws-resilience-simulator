# CloudWatch, CloudTrail, SQS and SNS behavior

## User workflow

Select a supported service and open **Behavior simulation** in its inspector. These are explicit
administrative experiments; they do not impersonate an application IAM principal.

- SQS: Send, Receive, copy the receipt handle, Delete, and advance the deterministic clock by
  30 seconds. Receive hides a message for the configured visibility timeout; it does not delete.
  An undeleted message becomes available again. The most recent receipt is required by this
  simplified model. Standard-queue duplicates are possible in AWS; random duplicates are not
  injected here. Queue arrows do not automatically run a consumer.
- SNS: connect topic → SQS using request-path connections (Message protocol recommended).
  Select the allowed topic in each queue's inspector. Publish fans out independently to every
  permitted queue. A failed/unauthorized subscriber does not turn an accepted publish into a
  publisher failure. Edge `filterPolicy` supports exact string lists against supplied message
  attributes in the engine; configuring attributes/filter policies is currently programmatic.
- CloudWatch: set an explicit sample and threshold. Evaluate a single-period >= alarm with
  missing/ignore/breaching/notBreaching treatment. Connect CloudWatch → SNS → SQS; entry into
  ALARM publishes a notification, while repeated ALARM samples do not repeat that action.
  Metrics are supplied explicitly, not inferred from icon placement or invented CPU values.
- CloudTrail: record example management/data API events; data events require opt-in. Connect
  SQS/SNS → CloudTrail to observe supported messaging operations. Logging failures do not fail
  the business operation. CloudTrail does not capture application logs or network packets.

Run Scenario also invokes these operations when reaching supported services. Its resulting
runtime snapshots are applied by the context and included in browser/JSON drafts. Inspector
operations share the same pure engine and use effective failure state without persisting
injected health overrides. Timeline playback alone does not execute operations again.

## Architecture and scope

`engine/services/operations.ts` owns behavior, deterministic time and state. `managedServices.ts`
adapts live request simulation to it; React only collects configuration and renders results.
Runtime state is stored at `customConfig.serviceRuntime`. The existing standalone service-model
registry is not the live execution path; its older messaging/CloudWatch models remain limited.

This is a partial educational model, not full AWS conformance:

- SNS queue permission is an explicit topic-ID allow-list approximating the resource policy,
  not the full IAM/resource-policy evaluator. Application producers retain the live IAM gate.
- No FIFO, deduplication, DLQ/redrive, long polling, batching, retention expiry, delivery retry
  scheduler, or arbitrary consumer execution. Inspector operations reset no state implicitly.
- No CloudWatch log ingestion, real metrics, multi-period/M-of-N evaluation, anomaly detection,
  autoscaling actions, or alarm-action authorization. This model supports SNS action delivery only.
- No CloudTrail account-wide discovery, multi-region collection, S3 delivery, event history,
  integrity validation or complete event selectors. Only explicitly connected supported messaging
  operations are auto-observed. Example events are not evidence a real AWS API ran.
- Existing generic networking/authorization approximations remain. SQS 202 is the application's
  educational asynchronous response, not a claim that AWS SendMessage itself returns 202.

## Sources and verification

- https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
- https://docs.aws.amazon.com/sns/latest/dg/sns-subscription-filter-policies.html
- https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarms-and-missing-data.html
- https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarm-actions.html
- https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-management-events-with-cloudtrail.html

`test/managed-services.test.ts` covers visibility expiry, receipt deletion, SNS filtering/policy
and fanout, alarm transitions, CloudTrail selectors, unavailable queues and live adapters.
UI integration proves live runtime persistence through draft export/import. Runs are deterministic
for identical state, configuration and inputs. No browser visual verification was performed.
