# Editing lab diagrams and automatic names

Loading a lab reference sets the draft name to its title; loading a reference diagram uses
its name. Export filename and Save-as-reference defaults follow the draft name. Users can
rename afterward; importing a draft still restores its stored name.

## Lab 1 authorization illustration

Draw User → IAM (also supported client/compute principals → IAM) or IAM → S3.
The canvas selects **Authorization illustration**, a dashed non-executable relationship.
It describes policy association; it does not grant permission, create credentials, call STS,
or forward application requests. Keep User → S3 for the actual service request.
Lab1's configured policy evaluator continues to determine ALLOW or DENY independently.

AWS source verified 2026-09-28:
https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html
https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-auth-workflow-object-operation.html

## Configuration-only links in other labs

The active lab may include topology links for behavior not executed by the request engine
(e.g. EC2 → EBS or pipeline relationships). Students can recreate the same source/destination
service pair as a **Lab configuration link (not request traffic)**. It uses the existing
management relationship, carries a referenceAnnotation marker, and remains UNKNOWN in the
contract report. This does not add AWS runtime support. The pair must exist in the active lab;
known-invalid requests do not receive this exception. Inspector conversion to an unknown
request is blocked. General unsupported pairs outside that lab remain rejected.

Tests: UI loading/naming/export, EC2/EBS redraw, invalid conversion rejection, Lab1 drawing
with ALLOW and explicit DENY. Contract test confirms authorization is neither request nor
child dependency traffic. Whole regression suite and build pass; no screenshot QA performed.
