import type { SubnetNaclConfig, NaclRule } from '../../types/index.ts';
/** Diagram 3.1 teaching preset, NOT the AWS custom-NACL default (which denies all). */
export function createTeachingNacl(label: string, isPublic: boolean, peerCidr = '0.0.0.0/0'): SubnetNaclConfig {
  const deny = (): NaclRule => ({ ruleNumber: 32767, type: 'All Traffic', protocol: 'All', portRange: 'All', cidr: '0.0.0.0/0', action: 'DENY' });
  return {
    naclName: `${label} NACL`, isCustom: true,
    inboundRules: [
      ...(isPublic ? [{ ruleNumber: 90, type: 'HTTP', protocol: 'TCP', portRange: '80', cidr: '0.0.0.0/0', action: 'ALLOW' as const }] : []),
      { ruleNumber: 100, type: 'TCP 3306', protocol: 'TCP', portRange: '3306', cidr: peerCidr, action: 'ALLOW' },
      { ruleNumber: 110, type: 'Ephemeral Ports', protocol: 'TCP', portRange: '1024-65535', cidr: isPublic ? peerCidr : '0.0.0.0/0', action: 'ALLOW', isStatelessReturn: true, isMissingReturn: false },
      deny()
    ],
    outboundRules: [
      { ruleNumber: 100, type: 'TCP 3306', protocol: 'TCP', portRange: '3306', cidr: peerCidr, action: 'ALLOW' },
      { ruleNumber: 110, type: 'All Traffic', protocol: 'All', portRange: 'All', cidr: '0.0.0.0/0', action: 'ALLOW' }, deny()
    ]
  };
}
