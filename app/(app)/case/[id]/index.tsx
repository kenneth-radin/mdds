import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, Field, KeyValue, Loading, Muted, Notice, Screen, Subtitle, Title } from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { MaintenanceCase } from '../../../../lib/types';
import { fmtDateTime, fmtNumber, EMPTY } from '../../../../lib/format';

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
        <KeyValue label="Status" value={item.status} />
        <KeyValue label="Urgency" value={item.urgency} />
        <KeyValue label="Reported" value={fmtDateTime(item.dateReported)} />
        <KeyValue label="Current problem" value={item.currentProblem} />
        <KeyValue label="Symptoms" value={item.symptoms.length ? item.symptoms.join(', ') : '—'} />
        <KeyValue label="Hours since last maintenance" value={fmtNumber(item.hoursSinceLastMaintenance, 1)} />
      </Card>
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Card>
        <Title>Analysis</Title>
        <Muted>Generated: {fmtDateTime(analysis.generatedAt)}</Muted>
        <Muted>Data used: {analysis.dataUsed.length ? analysis.dataUsed.join(' · ') : '—'}</Muted>
        {analysis.sufficientData ? <Notice tone="success">{analysis.message}</Notice> : <Notice tone="warning">{EMPTY.suggestions}</Notice>}
        {analysis.missingData.map((line) => (
          <Muted key={line}>• {line}</Muted>
        ))}
        {analysis.suggestions.length === 0 ? (
          <EmptyState
            title="Insufficient historical data for reliable analysis."
            message="Record more historical maintenance, failure and completed case data, then run the analysis again."
          />
        ) : (
          analysis.suggestions.map((suggestion) => (
            <Card key={suggestion.title}>
              <Title>{suggestion.title}</Title>
              <Muted>{suggestion.rationale}</Muted>
              <KeyValue label="Supporting records" value={String(suggestion.supportCount)} />
              <KeyValue label="Expected downtime" value={suggestion.expectedDowntimeHours === null ? '—' : `${suggestion.expectedDowntimeHours} h`} />
              <KeyValue label="Parts" value={suggestion.parts.length ? suggestion.parts.join(', ') : '—'} />
              <KeyValue label="Confidence (data-derived)" value={`${suggestion.confidence}%`} />
              <Muted>Evidence IDs: {suggestion.sourceRecordIds.join(', ')}</Muted>
              <Badge text="historical evidence" />
            </Card>
          ))
        )}
        <Button title={busy ? 'Working…' : 'Re-run analysis'} variant="secondary" onPress={analyzeAgain} disabled={busy} />
      </Card>

      {analysis.statistics ? (
        <Card>
          <Title>Historical statistics</Title>
          <KeyValue label="Maintenance records" value={String(analysis.statistics.totalMaintenanceRecords)} />
          <KeyValue label="Failure records" value={String(analysis.statistics.totalFailureRecords)} />
          <KeyValue label="MTBF (days)" value={fmtNumber(analysis.statistics.mtbfDays)} />
          <KeyValue label="MTTR (hours)" value={fmtNumber(analysis.statistics.mttrHours)} />
          <KeyValue label="Avg maintenance interval (days)" value={fmtNumber(analysis.statistics.averageMaintenanceIntervalDays)} />
          <KeyValue label="Avg downtime (hours)" value={fmtNumber(analysis.statistics.averageDowntimeHours)} />
          <KeyValue label="Avg cost" value={fmtNumber(analysis.statistics.averageCost)} />
          <KeyValue label="Failure modes" value={analysis.statistics.failureModes.length ? analysis.statistics.failureModes.map((f) => `${f.mode} (${f.count})`).join(', ') : '—'} />
          <KeyValue label="Common parts" value={analysis.statistics.commonParts.length ? analysis.statistics.commonParts.map((p) => `${p.part} (${p.count})`).join(', ') : '—'} />
          <KeyValue label="Common actions" value={analysis.statistics.commonActions.length ? analysis.statistics.commonActions.map((a) => `${a.action} (${a.count})`).join(', ') : '—'} />
        </Card>
      ) : null}

      <Card>
        <Title>Maintenance personnel review</Title>
        {item.review.decision ? (
          <>
            <KeyValue label="Decision" value={item.review.decision} />
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
          <KeyValue label="Result" value={item.outcome.result || '—'} />
          <KeyValue label="Action taken" value={item.actualAction.actionTaken || '—'} />
          <KeyValue label="Parts replaced" value={item.actualAction.partsReplaced.length ? item.actualAction.partsReplaced.join(', ') : '—'} />
          <KeyValue label="Downtime (h)" value={fmtNumber(item.actualAction.downtimeHours)} />
          <KeyValue label="Recorded" value={fmtDateTime(item.outcome.recordedAt)} />
        </Card>
      ) : (
        <Button title="Record actual maintenance & outcome" onPress={() => router.push(`/(app)/case/${id}/outcome`)} />
      )}

    </Screen>
  );
}
