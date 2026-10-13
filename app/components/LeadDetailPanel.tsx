"use client";
import { useEffect, useState } from "react";
import { sb } from "../../lib/supabase";

type Lead = {
  id: string; name: string; phone: string | null; email: string | null;
  company: string | null; stage: string; notes: string | null;
  next_follow_up_at: string | null; assigned_to: string | null;
  created_at: string; updated_at: string;
};
type Activity = {
  id: string; type: string; outcome: string | null; notes: string | null;
  created_at: string; worker_id: string;
};

const stages = ["new", "contacted", "interested", "follow_up", "quoted", "won", "lost"];
const localDateTime = (value: string | null) => value
  ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  : "";

export default function LeadDetailPanel({ leadId, actorId, onClose }: {
  leadId: string; actorId: string; onClose: () => void;
}) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stage, setStage] = useState("new");
  const [followUp, setFollowUp] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const [lr, ar] = await Promise.all([
      sb.from("leads").select("*").eq("id", leadId).maybeSingle(),
      sb.from("activities").select("id,type,outcome,notes,created_at,worker_id").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(100)
    ]);
    if (lr.error || !lr.data) {
      setError(lr.error?.message || "This lead is unavailable or you do not have permission to view it.");
      setLead(null);
      return;
    }
    setLead(lr.data as Lead);
    setStage(lr.data.stage || "new");
    setFollowUp(localDateTime(lr.data.next_follow_up_at));
    setNotes(lr.data.notes || "");
    if (ar.error) setError("Lead loaded, but its activity history could not be loaded: " + ar.error.message);
    else setActivities((ar.data || []) as Activity[]);
  }
  useEffect(() => { void load(); }, [leadId]);

  async function saveDetails() {
    if (!lead) return;
    setSaving(true); setError(""); setMessage("");
    const r = await sb.from("leads").update({
      stage,
      next_follow_up_at: followUp ? new Date(followUp).toISOString() : null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString()
    }).eq("id", leadId);
    setSaving(false);
    if (r.error) { setError(r.error.message); return; }
    setMessage("Lead details saved.");
    await load();
  }
  async function addNote() {
    const clean = notes.trim();
    if (!clean || !lead) return;
    setSaving(true); setError(""); setMessage("");
    const leadResult = await sb.from("leads").update({ notes: clean, updated_at: new Date().toISOString() }).eq("id", leadId);
    if (leadResult.error) { setSaving(false); setError(leadResult.error.message); return; }
    const activityResult = await sb.from("activities").insert({
      worker_id: actorId, lead_id: leadId, type: "note", notes: clean, outcome: "Note added"
    });
    setSaving(false);
    if (activityResult.error) {
      setError("The lead note was saved, but adding it to the timeline failed: " + activityResult.error.message);
      await load(); return;
    }
    setMessage("Note saved to the lead and timeline.");
    await load();
  }

  return <div className="lead-detail-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="card lead-detail stack" role="dialog" aria-modal="true" aria-label="Lead details">
      <div className="row lead-detail-heading">
        <div><span className="eyebrow">LEAD WORKSPACE</span><h2>{lead?.name || "Lead details"}</h2><p className="muted">Review contact information, update next steps, and track the conversation.</p></div>
        <button type="button" className="btn secondary" onClick={onClose}>Close</button>
      </div>
      {error && <div className="error">{error}</div>}
      {!lead && !error && <div className="lead-empty">Loading lead details…</div>}
      {lead && <>
        <div className="lead-detail-facts">
          <div><span className="muted">Company</span><b>{lead.company || "—"}</b></div>
          <div><span className="muted">Phone</span><b>{lead.phone || "—"}</b></div>
          <div><span className="muted">Email</span><b>{lead.email || "—"}</b></div>
          <div><span className="muted">Created</span><b>{new Date(lead.created_at).toLocaleString()}</b></div>
        </div>
        <div className="card stack">
          <h3>Next steps</h3>
          <label className="muted" htmlFor="lead-stage">Pipeline stage</label>
          <select id="lead-stage" className="input" value={stage} onChange={e => setStage(e.target.value)}>
            {stages.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <label className="muted" htmlFor="lead-follow-up">Next follow-up</label>
          <input id="lead-follow-up" className="input" type="datetime-local" value={followUp} onChange={e => setFollowUp(e.target.value)} />
          <label className="muted" htmlFor="lead-notes">Lead notes</label>
          <textarea id="lead-notes" className="input" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Context, needs, objections, or next conversation…" />
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn" disabled={saving} onClick={saveDetails}>{saving ? "Saving…" : "Save lead details"}</button>
            <button className="btn secondary" disabled={saving || !notes.trim()} onClick={addNote}>Add note to timeline</button>
          </div>
          {message && <div className="success">{message}</div>}
        </div>
        <div className="stack">
          <div><h3>Activity history</h3><p className="muted">Most recent contact and notes first.</p></div>
          {activities.length === 0 ? <div className="lead-empty">No activity logged for this lead yet.</div> :
            <div className="lead-timeline">{activities.map(a => <div className="lead-timeline-item" key={a.id}>
              <span className="lead-timeline-dot" />
              <div style={{ minWidth: 0, width: "100%" }}>
                <div className="row lead-activity-meta"><b>{a.type.replace("_", " ")}</b><span className="muted">{new Date(a.created_at).toLocaleString()}</span></div>
                {a.outcome && <p>{a.outcome}</p>}{a.notes && a.notes !== a.outcome && <p>{a.notes}</p>}
              </div>
            </div>)}</div>}
        </div>
      </>}
    </section>
  </div>;
}
