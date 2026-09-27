# EC2 S3 role attachment

Select EC2 → EC2 IAM role → choose a bucket and role name → Attach S3 role. Read/list permissions
are scoped to that bucket; PutObject is optional. Existing roles are shown without replacement;
Detach removes the attachment. The instance-profile relationship is represented by `data.iamRole`.

The live authorization engine evaluates EC2 service trust and identity policies. Legacy `ec2`
trust identifiers normalize to `ec2.amazonaws.com`. For EC2 S3 GetObject/PutObject calls with
only a bucket ARN, the current representative resource is `/simulated-object`; explicit object
ARNs remain intact. Network reachability is a separate check. S3 resource policies and arbitrary
IAM role authoring are not exposed by this panel.

Test: `test/ec2-iam-role.test.ts` covers trust, scoped reads, denied writes, wrong buckets,
missing role and wildcard bucket rejection. Roles persist as part of node data in drafts.
Source: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html
