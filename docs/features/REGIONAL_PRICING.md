# Regional pricing toggle

The Cost Estimator (`CostEstimatorModal.tsx`) has a **Pricing Region** toggle with three options:
**United States**, **Europe**, **Asia Pacific**. It's a local override on the modal (same pattern
as the existing traffic-load simulator), not global state - closing and reopening the modal resets
to United States.

Every dollar figure already in `costCalculator.ts` (`EC2_INSTANCE_TYPES`, `EBS_VOLUME_TYPES`,
`S3_STORAGE_CLASSES`, `RDS_INSTANCE_TYPES`, and the per-service pricing modules) is a US East
(N. Virginia / us-east-1) on-demand rate. `calculateNodeCost`/`calculateArchitectureCost` now take
a `CostRegion` (`'us-east-1' | 'eu-west-1' | 'ap-south-1'`) and scale each node's line items by a
per-category multiplier (`REGION_MULTIPLIERS` in `costCalculator.ts`): compute, storage, database,
and networking each get their own blended premium, applied after the module computes its normal
US-East-1 line items.

**What this is not**: a live per-SKU pricing lookup. AWS's actual per-instance-type, per-GB rates
vary individually by region and change over time; pulling exact current figures for every SKU in
every region (compute, storage, database, and networking, for every instance type this calculator
already models) is outside what a static blended multiplier - or this feature - can honestly claim.
Instead, each region has one multiplier per resource category, grounded in AWS's well-documented,
stable regional pricing pattern (US regions cheapest; EU next; Asia Pacific - and Mumbai
specifically - commonly cited at roughly 20-30% above US East for compute). This is the same level
of fidelity the rest of this cost estimator already operates at (illustrative, FinOps-education
oriented, not a live billing integration) - not a new, weaker standard introduced for this feature.

Per the requesting instructions, UI labels stay continent-level and never name a specific city
(no "Ireland", no "Mumbai", no "N. Virginia") - internally, Europe's multiplier is modeled off
EU-West (Ireland) and Asia Pacific's off AP-South (Mumbai) as representative regions, so the
relative cost difference means something concrete rather than being an arbitrary percentage.

**Exemptions**: `route53` and `eks` are exempt from the regional multiplier - both genuinely bill
one flat, global rate in real AWS regardless of region (Route 53's hosted zone/query fees, EKS's
per-cluster control-plane fee), so scaling them would be actively wrong, not just approximate.

FinOps recommendation savings estimates that are hardcoded flat dollar amounts (not already derived
from a node's regionally-scaled cost) are scaled by the matching category multiplier too, so a
recommendation's savings figure stays consistent with the selected region.

Source: general knowledge of AWS's public, stable regional pricing structure (US cheapest, EU
mid-tier, Asia Pacific/Mumbai commonly ~20-30% above US East for compute); consult the AWS Pricing
Calculator for an authoritative, current, per-SKU quote.

Validation: US East reproduces the module's own unscaled dollar figures exactly; Europe and Asia
Pacific each cost strictly more, in the right order; Route 53 and EKS are unaffected by region;
the architecture-wide report and its FinOps tips carry the selected region and label through.
Full suite: 430 tests passed.
