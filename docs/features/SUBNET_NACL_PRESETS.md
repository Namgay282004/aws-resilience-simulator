# Subnet NACL rule sets

Select any public/private subnet and choose **Enable NACL rule set**. This creates an independent
teaching preset based on diagram 3.1, then opens the NACL panel. Existing custom NACLs expose
**View NACL Rules** and are not overwritten. Legacy inbound protocol denies are retained as
lower-numbered deny rules when enabling the preset.

Public presets allow HTTP, MySQL and ephemeral return traffic; private presets allow MySQL
and ephemeral return traffic. Both include outbound rules and a final deny. New presets use
0.0.0.0/0 instead of inventing a peer subnet address: review/edit the CIDRs before treating the
configuration as a design. Existing reference diagrams retain their original scoped CIDRs.
This is an educational preset, not AWS's deny-all initial custom NACL configuration.

The panel lists actual rule data, supports selecting any configured subnet, and edits its CIDRs,
actions and missing-ephemeral-return experiment. Rules are stored on the subnet and included in
saved/downloaded drafts. Newly enabled presets allow return traffic; diagram 3.1 retains its
intentional missing-return state. No static success/failure diagnosis is claimed by the panel;
run the simulator to get the result.

Coverage remains partial: existing live inbound protocol matching and the database return-rule
experiment apply. Full outbound/CIDR/packet enforcement is not introduced by this UI change.

The canvas's "Architectural Diagram addressing problem 3.1" banner does **not** appear just
because a subnet has `customNacl` set - it only appears when a subnet's ephemeral-return rule is
actually marked missing (`isStatelessReturn && isMissingReturn`, see `ArchitectureContext.tsx`'s
`hasMissingReturnNacl`). Enabling the preset here always creates a complete rule set with return
traffic allowed, so it never triggers that banner; only the original Problem 3.1 reference diagram
(or a subnet where the missing-return experiment checkbox has been explicitly turned on) does.

Source: https://docs.aws.amazon.com/vpc/latest/userguide/custom-network-acl.html

Validation: independent public/private presets, implicit deny, explicit subnet return checks,
missing-return toggling, UI enablement, draft persistence, and that enabling the preset does not
trigger the Problem 3.1 banner while the actual Problem 3.1 diagram still does. Full suite: 427
tests passed.
