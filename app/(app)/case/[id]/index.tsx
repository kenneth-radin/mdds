import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, Divider, EmptyState, Field, KeyValue, Loading, Muted, Notice, Screen, Subtitle, Title } from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { MaintenanceCase } from '../../../../lib/types';
import { fmtDateTime, fmtNumber, humanize, EMPTY } from '../../../../lib/format';

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<MaintenanceCase | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [modified, setModified] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ maintenanceCase: MaintenanceCase }>(`/api/maintenance-cases/${id}`);
      setItem(result.maintenanceCase);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const analyzeAgain = async () => {
    setBusy(true);
    try {
      const result = await api.post<{ maintenanceCase: MaintenanceCase }>(`/api/maintenance-cases/${id}/analyze`);
      setItem(result.maintenanceCase);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const review = async (decision: 'accepted' | 'modified' | 'rejected') => {
    setBusy(true);
    try {
      const result = await api.put<{ maintenanceCase: MaintenanceCase }>(`/api/maintenance-cases/${id}/review`, {
        decision,
        modifiedSuggestion: decision === 'modified' ? modified : '',
        reviewerNote: note
      });
      setItem(result.maintenanceCase);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !item) return <Screen><Loading /></Screen>;
  if (!item) return <Screen><Notice tone="danger">{error || 'Maintenance case not found.'}</Notice></Screen>;

  const machine = typeof item.machine === 'string' ? null : item.machine;
  const analysis = item.analysis;

  return (
    <Screen>
      <Title>{item.caseNumber}</Title>
      <Subtitle>{machine ? `${machine.machineId} · ${machine.name}` : 'Machine'}</Subtitle>
      <Card>
        <KeyValue label="Status" value={humanize(item.status)} />
        <KeyValue label="Urgency" value={humanize(item.urgency)} />
        <KeyValue label="Reported" value={fmtDateTime(item.dateReported)} />
        <KeyValue label="Current problem" value={item.currentProblem} />
        <KeyValue label="Symptoms" value={item.symptoms.length ? item.symptoms.join(', ') : '—'} />
        <KeyValue label="Hours since last maintenance" value={fmtNumber(item.hoursSinceLastMaintenance, 1)} />
      </Card>
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Card>
        <Title>Analysis & suggestions</Title>
        <Muted>Generated: {fmtDateTime(analysis.generatedAt)}</Muted>
        <Muted>Inputs: {analysis.dataUsed.length ? analysis.dataUsed.join(' · ') : '—'}</Muted>
        {analysis.sufficientData ? (
          <Notice tone="success">{analysis.message}</Notice>
        ) : (
          <Notice tone="warning">{EMPTY.suggestions}</Notice>
        )}
        {analysis.missingData.map((line) => (
          <Muted key={line}>• {line}</Muted>
        ))}

        {analysis.suggestions.length === 0 ? (
          <EmptyState
            title="Not enough similar past records to suggest a solution yet."
            message="Add more maintenance, failure, or completed-case records for this machine, then re-run analysis."
          />
        ) : (
          analysis.suggestions.map((suggestion) => (
            <Card key={suggestion.title}>
              <Title>{suggestion.title}</Title>
              <Muted>{suggestion.rationale}</Muted>
              <KeyValue label="Supporting past records" value={String(suggestion.supportCount)} />
              <KeyValue
                label="Average past downtime"
                value={suggestion.expectedDowntimeHours === null ? '—' : `${suggestion.expectedDowntimeHours} hr`}
              />
              <KeyValue label="Parts used in past" value={suggestion.parts.length ? suggestion.parts.join(', ') : '—'} />
              <KeyValue label="Evidence strength" value={`${suggestion.confidence}%`} />

              {suggestion.evidence && suggestion.evidence.length > 0 ? (
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>Supporting past records:</Text>
                  {suggestion.evidence.map((ev, idx) => (
                    <Text key={idx} style={{ fontSize: 11, color: '#64748b', lineHeight: 16 }}>
                      • {ev}
                    </Text>
                  ))}
                </View>
              ) : null}
            </Card>
          ))
        )}
        <Button title={busy ? 'Working…' : 'Re-run analysis'} variant="secondary" onPress={analyzeAgain} disabled={busy} />
      </Card>

      {/* Explainer: How this analysis works */}
      <Card>
        <Title>How this analysis works</Title>
        <Subtitle>Evidence-based decision support from your machine's real recorded history.</Subtitle>
        <Text style={{ fontSize: 12, color: '#475569', lineHeight: 18 }}>
          1. We compare the current problem and symptoms with all previous maintenance jobs, failure reports, and resolved cases for this machine.
        </Text>
        <Text style={{ fontSize: 12, color: '#475569', lineHeight: 18, marginTop: 4 }}>
          2. Records with matching wording are ranked using TF-IDF text similarity — identical phrases rank higher than common words.
        </Text>
        <Text style={{ fontSize: 12, color: '#475569', lineHeight: 18, marginTop: 4 }}>
          3. Actions taken in the closest past cases become suggestions, ranked by how often they were used and how closely they match.
        </Text>
        <Text style={{ fontSize: 12, color: '#475569', lineHeight: 18, marginTop: 4 }}>
          4. "Evidence strength" reflects the number and similarity of matching records. It is a guide based on past data, not a guarantee.
        </Text>
        <Text style={{ fontSize: 12, color: '#475569', lineHeight: 18, marginTop: 4 }}>
          5. If fewer than 3 similar records exist, the system states that data is insufficient rather than guessing.
        </Text>
      </Card>

      {analysis.statistics ? (
        <Card>
          <Title>Machine history statistics</Title>
          <KeyValue label="Past maintenance jobs" value={String(analysis.statistics.totalMaintenanceRecords)} />
          <KeyValue label="Past failure reports" value={String(analysis.statistics.totalFailureRecords)} />
          <KeyValue label="Avg days between failures" value={fmtNumber(analysis.statistics.mtbfDays)} />
          <KeyValue label="Avg repair time" value={analysis.statistics.mttrHours === null ? '—' : `${fmtNumber(analysis.statistics.mttrHours)} hr`} />
          <KeyValue label="Avg maintenance interval" value={analysis.statistics.averageMaintenanceIntervalDays === null ? '—' : `${fmtNumber(analysis.statistics.averageMaintenanceIntervalDays)} days`} />
          <KeyValue label="Avg recorded downtime" value={analysis.statistics.averageDowntimeHours === null ? '—' : `${fmtNumber(analysis.statistics.averageDowntimeHours)} hr`} />
          <KeyValue label="Avg recorded cost" value={fmtNumber(analysis.statistics.averageCost)} />
          <KeyValue
            label="Past failure modes"
            value={analysis.statistics.failureModes.length ? analysis.statistics.failureModes.map((f) => `${f.mode} (${f.count})`).join(', ') : '—'}
          />
          <KeyValue
            label="Common parts replaced"
            value={analysis.statistics.commonParts.length ? analysis.statistics.commonParts.map((p) => `${p.part} (${p.count})`).join(', ') : '—'}
          />
          <KeyValue
            label="Common actions taken"
            value={analysis.statistics.commonActions.length ? analysis.statistics.commonActions.map((a) => `${a.action} (${a.count})`).join(', ') : '—'}
          />
        </Card>
      ) : null}

      <Card>
        <Title>Maintenance personnel review</Title>
        {item.review.decision ? (
          <>
            <KeyValue label="Decision" value={humanize(item.review.decision)} />
            <KeyValue label="Modified suggestion" value={item.review.modifiedSuggestion || '—'} />
            <KeyValue label="Reviewer note" value={item.review.reviewerNote || '—'} />
            <KeyValue label="Reviewed" value={fmtDateTime(item.review.reviewedAt)} />
          </>
        ) : (
          <>
            <Field label="Modified suggestion (if modifying)" value={modified} onChangeText={setModified} placeholder="Your corrected recommendation" />
            <Field label="Reviewer note" value={note} onChangeText={setNote} placeholder="Reason for the decision" />
            <Button title="Accept suggestion" onPress={() => review('accepted')} disabled={busy} />
            <Button title="Modify suggestion" variant="secondary" onPress={() => review('modified')} disabled={busy} />
            <Button title="Reject suggestion" variant="danger" onPress={() => review('rejected')} disabled={busy} />
          </>
        )}
      </Card>

      {item.status === 'completed' ? (
        <Card>
          <Title>Recorded outcome</Title>
          <KeyValue label="Result" value={humanize(item.outcome.result)} />
          <KeyValue label="Action taken" value={item.actualAction.actionTaken || '—'} />
          <KeyValue label="Parts replaced" value={item.actualAction.partsReplaced.length ? item.actualAction.partsReplaced.join(', ') : '—'} />
          <KeyValue label="Downtime" value={item.actualAction.downtimeHours === null ? '—' : `${fmtNumber(item.actualAction.downtimeHours)} hr`} />
          <KeyValue label="Recorded" value={fmtDateTime(item.outcome.recordedAt)} />
        </Card>
      ) : (
        <Button title="Record actual maintenance & outcome" onPress={() => router.push(`/(app)/case/${id}/outcome`)} />
      )}

    </Screen>
  );
}