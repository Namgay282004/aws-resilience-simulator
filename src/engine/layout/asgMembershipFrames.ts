import type { Node } from '@xyflow/react';

/** Display-only membership frames. Never reparent instances or enter the architecture model. */
export function asgMembershipFrames(nodes: Node<any>[]): Node[] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const absolute = (node: Node<any>) => {
    const position = { ...node.position };
    const seen = new Set([node.id]);
    let parent = byId.get(node.parentId ?? '');
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id);
      position.x += parent.position.x; position.y += parent.position.y;
      parent = byId.get(parent.parentId ?? '');
    }
    return position;
  };
  const frames: Node[] = [];
  for (const group of nodes.filter(n => n.data.serviceId === 'ec2_auto_scaling' && !n.hidden)) {
    const initial = new Set(group.data.customConfig?.asg?.memberIds ?? []);
    const subnets = new Map<string, Node<any>[]>();
    for (const node of nodes) {
      if (node.hidden || node.data.serviceId !== 'ec2' || (!initial.has(node.id) && node.data.customConfig?.asgInstance?.groupId !== group.id)) continue;
      const subnet = node.data.networkIdentity?.subnetId ?? node.parentId ?? 'unplaced';
      subnets.set(subnet, [...(subnets.get(subnet) ?? []), node]);
    }
    // Separate frames per subnet avoid implying ASGs are network containers or covering other AZs.
    for (const [subnet, members] of subnets) {
      const boxes = members.map(node => ({ ...absolute(node), width: node.measured?.width ?? node.width ?? 160, height: node.measured?.height ?? node.height ?? 100 }));
      const x = Math.min(...boxes.map(b => b.x)) - 16;
      const y = Math.min(...boxes.map(b => b.y)) - 36;
      const width = Math.max(...boxes.map(b => b.x + b.width)) - x + 16;
      const height = Math.max(...boxes.map(b => b.y + b.height)) - y + 16;
      frames.push({ id: `__asg-frame:${group.id}:${subnet}`, type: 'asgMembershipFrame', position: { x, y },
        data: { label: `${group.data.label} · ${members.length} EC2`, boundaryType: 'asg' },
        style: { width, height, pointerEvents: 'none' }, zIndex: 2,
        draggable: false, selectable: false, connectable: false, focusable: false });
    }
  }
  return frames;
}
