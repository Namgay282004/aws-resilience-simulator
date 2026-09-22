import React, { useState } from 'react';
import { ArrowDown, Box } from 'lucide-react';
export function EventBridgeLesson({ scheduler }: { scheduler: boolean }) {
  const [event, setEvent] = useState('OrderCreated');
  const [tasks, setTasks] = useState(0);
  const [message, setMessage] = useState('No target invocation yet.');
  return <section aria-label="EventBridge task invocation demonstration" className="space-y-4 text-sm">
    <h3 className="text-lg font-semibold">{scheduler ? 'Schedule → RunTask' : 'Matching event → RunTask'}</h3>
    <p>{scheduler ? 'EventBridge Scheduler invokes its configured ECS RunTask target at a scheduled time.' : 'An EventBridge event bus rule matches an event pattern and invokes its configured ECS task target.'} This starts standalone tasks; it does not change an ECS service’s desired count.</p>
    {!scheduler && <label className="block">Example event detail-type<select className="block w-full border rounded p-2 mt-1" value={event} onChange={e => setEvent(e.target.value)}><option>OrderCreated</option><option>OrderCancelled</option></select></label>}
    <div className="border-2 border-circuit-500 rounded p-4 bg-circuit-50">{scheduler ? 'Example schedule: rate(5 minutes)' : 'Example rule: detail-type = OrderCreated'}</div><ArrowDown aria-hidden="true" className="mx-auto text-circuit-700" />
    <div className="border rounded p-3">Execution role → ecs:RunTask + appropriate iam:PassRole permissions → ECS API</div>
    <button disabled={tasks >= 8} className="min-h-11 border rounded px-3 py-2 bg-white disabled:opacity-50" onClick={() => {
      if (!scheduler && event !== 'OrderCreated') { setMessage('Event did not match the rule. RunTask was not invoked.'); return; }
      setTasks(n => n + 1); setMessage('One successful RunTask invocation illustrated; service desired count remains 2.');
    }}>{scheduler ? 'Trigger example scheduled invocation' : 'Publish example event'}</button>
    <button className="min-h-11 border rounded px-3 py-2 ml-2 bg-white" onClick={() => { setTasks(0); setMessage('No target invocation yet.'); }}>Reset example</button>
    <p role="status">{message}</p>
    <section className="border rounded p-4 space-y-2" aria-label="Standalone task examples"><strong>{tasks} standalone task examples</strong><div className="flex flex-wrap gap-2">{Array.from({ length: tasks }, (_, i) => <div key={i} className="ecs-demo-arrive border rounded p-3"><Box size={20} />Task {i + 1}</div>)}</div></section>
    <div className="border rounded p-3 bg-slate-50">Separate ECS service: desired count 2 (unchanged)</div>
    <p>Scheduled scaling belongs to the relevant Auto Scaling service. It changes capacity bounds; it is different from an EventBridge RunTask schedule. Other API integrations require explicit configuration and permissions.</p>
    <p className="text-xs text-slate-500">Assumes valid roles, capacity, and successful startup. Real target delivery can retry; the example does not promise exactly-once execution. No scheduler, task, or event is created. Up to eight examples are shown.</p>
    <a target="_blank" rel="noreferrer" className="block underline text-circuit-700" href={scheduler ? 'https://docs.aws.amazon.com/AmazonECS/latest/developerguide/tasks-scheduled-eventbridge-scheduler.html' : 'https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-targets.html'}>AWS: {scheduler ? 'Scheduler ECS tasks' : 'Event bus targets'}</a>
  </section>;
}
