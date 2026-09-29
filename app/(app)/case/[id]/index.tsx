import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  Chip,
  Collapse,
  Divider,
  EmptyState,
  Field,
  KeyValue,
  Loading,
  Muted,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatCard,
  theme
} from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api';
import { MaintenanceCase } from '../../../../lib/types';
import { fmtDateTime, fmtNumber, humanize, EMPTY } from '../../../../lib/format';

/** Turns a stored enum into a coloured badge without leaking raw values to the UI. */
function statusTone(status: MaintenanceCase['status']) {
  if (status === 'completed') return 'success' as const;
  if (status === 'draft') return 'warning' as const;
  return 'info' as const;
}

function urgencyTone(urgency: MaintenanceCase['urgency']) {
  if (urgency === 'high') return 'danger' as const;
  if (urgency === 'medium') return 'warning' as const;
  return 'info' as const;
}

/** Evidence strength is a percentage against similarly-worded past records (§23). */
function confidenceLabel(confidence: number): string {
  if (confidence >= 60) return 'strong evidence';
  if (confidence >= 30) return 'moderate evidence';
  return 'limited evidence';
}

function confidenceTone(confidence: number) {
  if (confidence >= 60) return 'success' as const;
  if (confidence >= 30) return 'warning' as const;
  return 'info' as const;
}

function reviewTone(decision: MaintenanceCase['review']['decision']) {
  if (decision === 'accepted') return 'success' as const;
  if (decision === 'rejected') return 'danger' as const;
  return 'warning' as const;
}

/** Plain-English explanation of the retrieval pipeline, kept behind a tap. */
const HOW_IT_WORKS = [
  'We compare the current problem and symptoms with all previous maintenance jobs, failure reports, and resolved cases for this machine.',
  'Records with matching wording are ranked using TF-IDF text similarity — identical phrases rank higher than common words.',
  'Actions taken in the closest past cases become suggestions, ranked by how often they were used and how closely they match.',
  '"Evidence strength" reflects the number and similarity of matching records. It is a guide based on past data, not a guarantee.',
  'If fewer than 3 similar records exist, the system states that data is insufficient rather than guessing.'
];

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

  if (loading && !item) {
    return (
      <Screen>
        <Loading
          label="Loading maintenance case…"
          caption="Fetching the case, its machine history and the latest analysis."
        />
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Maintenance case unavailable"
          message={error || 'This case could not be found. It may have been removed.'}
        />
      </Screen>
    );
  }

  const machine = typeof item.machine === 'string' ? null : item.machine;
  const analysis = item.analysis;
  const bestSuggestion = analysis.suggestions.length ? analysis.suggestions[0] : null;

  return (
    <Screen>
      <ScreenHeader
        title={item.caseNumber}
        subtitle={machine ? `${machine.machineId} · ${machine.name}` : 'Machine'}
        badge={<Badge text={humanize(item.status)} tone={statusTone(item.status)} />}
      />

      <View style={st.statRow}>
        <StatCard
          label="Urgency"
          value={humanize(item.urgency)}
          icon="alert-circle-outline"
          tone={item.urgency === 'high' ? 'warning' : 'default'}
        />
        <StatCard
          label="Since service"
          value={fmtNumber(item.hoursSinceLastMaintenance, 0)}
          hint="hours logged"
          icon="time-outline"
        />
        <StatCard
          label="Best evidence"
          value={bestSuggestion ? `${bestSuggestion.confidence}%` : '—'}
          hint={bestSuggestion ? confidenceLabel(bestSuggestion.confidence) : 'no suggestion yet'}
          icon="analytics-outline"
          tone="primary"
        />
      </View>

      {error ? (
        <Notice tone="danger" title="Something went wrong">
          {error}
        </Notice>
      ) : null}

      <Card>
        <SectionHeader title="Case details" icon="document-text-outline" />
        <KeyValue label="Reported" value={fmtDateTime(item.dateReported)} />
        <KeyValue label="Current problem" value={item.currentProblem} />
        <KeyValue label="Symptoms" value={item.symptoms.length ? item.symptoms.join(', ') : '—'} />
        <KeyValue label="Urgency" value={humanize(item.urgency)} />
        <KeyValue
          label="Hours since last maintenance"
          value={fmtNumber(item.hoursSinceLastMaintenance, 1)}
        />
      </Card>

      <SectionHeader
        title="Analysis"
        icon="sparkles-outline"
        subtitle={
          analysis.generatedAt
            ? `Generated ${fmtDateTime(analysis.generatedAt)} from this machine's recorded history.`
            : 'Not analysed yet — compare this case with past records.'
        }
      />

      <Card>
        {analysis.sufficientData ? (
          <Notice tone="success" title="Enough history to compare">
            {analysis.message}
          </Notice>
        ) : (
          <Notice tone="warning" title="More history needed">
            {EMPTY.suggestions}
          </Notice>
        )}

        {analysis.missingData.length ? (
          <View style={{ marginTop: theme.space.md }}>
            <Text style={st.fieldLabel}>Records that would sharpen the answer</Text>
            {analysis.missingData.map((line) => (
              <Text key={line} style={st.bullet}>
                • {line}
              </Text>
            ))}
          </View>
        ) : null}

        <Collapse
          title="What this analysis read"
          subtitle={`${analysis.dataUsed.length} source${analysis.dataUsed.length === 1 ? '' : 's'} on this machine`}
        >
          {analysis.dataUsed.length ? (
            analysis.dataUsed.map((line) => (
              <Text key={line} style={st.bullet}>
                • {line}
              </Text>
            ))
          ) : (
            <Muted>No recorded history was available for this machine yet.</Muted>
          )}
        </Collapse>

        <Button
          title={busy ? 'Analysing…' : 'Re-run analysis'}
          variant="secondary"
          icon="refresh-outline"
          onPress={analyzeAgain}
          disabled={busy}
        />
      </Card>

      <SectionHeader
        title="Suggested actions"
        icon="build-outline"
        subtitle={
          analysis.suggestions.length
            ? 'Ranked by how often they solved the same problem on this machine before.'
            : undefined
        }
        action={
          analysis.suggestions.length ? (
            <Chip label={String(analysis.suggestions.length)} tone="primary" />
          ) : undefined
        }
      />

      {analysis.suggestions.length === 0 ? (
        <EmptyState
          icon="bulb-outline"
          title="No suggestion yet"
          message="Not enough similar past records to propose a solution. Add more maintenance, failure, or completed-case records for this machine, then re-run the analysis."
        />
      ) : (
        analysis.suggestions.map((suggestion, index) => (
          <Card key={suggestion.title} tone={index === 0 ? 'hero' : 'default'}>
            <View style={st.suggestionHead}>
              <Text style={st.suggestionTitle}>{suggestion.title}</Text>
              <Badge
                text={confidenceLabel(suggestion.confidence)}
                tone={confidenceTone(suggestion.confidence)}
              />
            </View>
            <Muted>{suggestion.rationale}</Muted>

            <View style={[st.statRow, { marginTop: theme.space.md }]}>
              <StatCard
                label="Evidence"
                value={`${suggestion.confidence}%`}
                icon="analytics-outline"
                tone="primary"
              />
              <StatCard
                label="Similar records"
                value={String(suggestion.supportCount)}
                icon="albums-outline"
              />
              <StatCard
                label="Past downtime"
                value={
                  suggestion.expectedDowntimeHours === null
                    ? '—'
                    : `${fmtNumber(suggestion.expectedDowntimeHours, 1)} h`
                }
                icon="time-outline"
              />
            </View>

            <View style={{ marginTop: theme.space.md }}>
              <KeyValue label="Recommended action" value={suggestion.recommendedAction} />
            </View>

            {suggestion.parts.length ? (
              <View style={{ marginTop: theme.space.sm }}>
                <Text style={st.fieldLabel}>Parts used in similar repairs</Text>
                <View style={st.chipRow}>
                  {suggestion.parts.map((part) => (
                    <Chip key={part} label={part} icon="construct-outline" />
                  ))}
                </View>
              </View>
            ) : null}

            {suggestion.evidence && suggestion.evidence.length > 0 ? (
              <Collapse
                title="Supporting past records"
                subtitle={`${suggestion.evidence.length} matching record${
                  suggestion.evidence.length === 1 ? '' : 's'
                }`}
                badge={
                  <Badge
                    text={`${suggestion.sourceRecordIds.length} linked`}
                    tone="info"
                    size="sm"
                  />
                }
              >
                {suggestion.evidence.map((ev, idx) => (
                  <Text key={idx} style={st.bullet}>
                    • {ev}
                  </Text>
                ))}
              </Collapse>
            ) : null}
          </Card>
        ))
      )}

      {/* Explainer: how the retrieval pipeline works, kept behind a tap so the page stays scannable */}
      <Card tone="muted">
        <Collapse
          title="How this analysis works"
          subtitle="Evidence-based decision support from this machine's real recorded history"
          badge={<Chip label={`${HOW_IT_WORKS.length} steps`} icon="git-branch-outline" />}
        >
          {HOW_IT_WORKS.map((step, index) => (
            <View key={step} style={st.stepRow}>
              <Text style={st.stepNumber}>{index + 1}</Text>
              <Text style={st.stepText}>{step}</Text>
            </View>
          ))}
        </Collapse>
      </Card>

      {analysis.statistics ? (
        <Card tone="muted">
          <Collapse
            title="Machine history statistics"
            subtitle="Everything the analyser counted before ranking the suggestions"
            badge={
              <Chip
                label={`${analysis.statistics.comparableCases} comparable`}
                icon="albums-outline"
              />
            }
          >
            <View style={st.statRow}>
              <StatCard
                label="Maintenance jobs"
                value={String(analysis.statistics.totalMaintenanceRecords)}
                icon="construct-outline"
              />
              <StatCard
                label="Failure reports"
                value={String(analysis.statistics.totalFailureRecords)}
                icon="warning-outline"
              />
              <StatCard
                label="Completed cases"
                value={String(analysis.statistics.totalCompletedCases)}
                icon="checkmark-done-outline"
              />
            </View>
            <Divider />
            <KeyValue
              label="Avg days between failures"
              value={fmtNumber(analysis.statistics.mtbfDays)}
            />
            <KeyValue
              label="Avg repair time"
              value={
                analysis.statistics.mttrHours === null
                  ? '—'
                  : `${fmtNumber(analysis.statistics.mttrHours)} hr`
              }
            />
            <KeyValue
              label="Avg maintenance interval"
              value={
                analysis.statistics.averageMaintenanceIntervalDays === null
                  ? '—'
                  : `${fmtNumber(analysis.statistics.averageMaintenanceIntervalDays)} days`
              }
            />
            <KeyValue
              label="Avg recorded downtime"
              value={
                analysis.statistics.averageDowntimeHours === null
                  ? '—'
                  : `${fmtNumber(analysis.statistics.averageDowntimeHours)} hr`
              }
            />
            <KeyValue label="Avg recorded cost" value={fmtNumber(analysis.statistics.averageCost)} />
            <KeyValue
              label="Past failure modes"
              value={
                analysis.statistics.failureModes.length
                  ? analysis.statistics.failureModes.map((f) => `${f.mode} (${f.count})`).join(', ')
                  : '—'
              }
            />
            <KeyValue
              label="Common parts replaced"
              value={
                analysis.statistics.commonParts.length
                  ? analysis.statistics.commonParts.map((p) => `${p.part} (${p.count})`).join(', ')
                  : '—'
              }
            />
            <KeyValue
              label="Common actions taken"
              value={
                analysis.statistics.commonActions.length
                  ? analysis.statistics.commonActions.map((a) => `${a.action} (${a.count})`).join(', ')
                  : '—'
              }
            />
          </Collapse>
        </Card>
      ) : null}

      <Card>
        <SectionHeader
          title="Maintenance personnel review"
          icon="shield-checkmark-outline"
          subtitle="The analyser only advises — your decision is what counts."
        />
        {item.review.decision ? (
          <>
            <View style={st.suggestionHead}>
              <Text style={st.fieldLabel}>Decision</Text>
              <Badge text={humanize(item.review.decision)} tone={reviewTone(item.review.decision)} />
            </View>
            <KeyValue label="Modified suggestion" value={item.review.modifiedSuggestion || '—'} />
            <KeyValue label="Reviewer note" value={item.review.reviewerNote || '—'} />
            <KeyValue label="Reviewed" value={fmtDateTime(item.review.reviewedAt)} />
          </>
        ) : (
          <>
            <Field
              label="Modified suggestion (if modifying)"
              value={modified}
              onChangeText={setModified}
              placeholder="Your corrected recommendation"
              helper="Only used when you choose “Modify suggestion”."
              multiline
            />
            <Field
              label="Reviewer note"
              value={note}
              onChangeText={setNote}
              placeholder="Why you accepted, changed or rejected the suggestion"
              multiline
            />
            <ButtonGroup>
              <Button
                title="Accept suggestion"
                icon="checkmark-outline"
                onPress={() => review('accepted')}
                disabled={busy}
              />
              <Button
                title="Modify suggestion"
                variant="secondary"
                icon="create-outline"
                onPress={() => review('modified')}
                disabled={busy}
              />
              <Button
                title="Reject suggestion"
                variant="danger"
                icon="close-outline"
                onPress={() => review('rejected')}
                disabled={busy}
              />
            </ButtonGroup>
          </>
        )}
      </Card>

      {item.status === 'completed' ? (
        <Card>
          <SectionHeader title="Recorded outcome" icon="checkmark-done-outline" />
          <KeyValue label="Result" value={humanize(item.outcome.result)} />
          <KeyValue label="Action taken" value={item.actualAction.actionTaken || '—'} />
          <KeyValue
            label="Parts replaced"
            value={
              item.actualAction.partsReplaced.length
                ? item.actualAction.partsReplaced.join(', ')
                : '—'
            }
          />
          <KeyValue
            label="Downtime"
            value={
              item.actualAction.downtimeHours === null
                ? '—'
                : `${fmtNumber(item.actualAction.downtimeHours)} hr`
            }
          />
          <KeyValue label="Recorded" value={fmtDateTime(item.outcome.recordedAt)} />
        </Card>
      ) : (
        <Button
          title="Record actual maintenance & outcome"
          icon="create-outline"
          onPress={() => router.push(`/(app)/case/${id}/outcome`)}
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    // Reflow 3-card rows to 2+1 instead of shrinking every card when the
    // screen is too narrow for three readable columns.
    flexWrap: 'wrap',
    gap: theme.space.md
  },
  suggestionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.space.xs
  },
  suggestionTitle: {
    ...theme.font.cardTitle,
    color: theme.text,
    flex: 1,
    marginRight: theme.space.sm
  },
  fieldLabel: {
    ...theme.font.captionMedium,
    color: theme.textSecondary,
    marginBottom: theme.space.xs
  },
  bullet: {
    ...theme.font.caption,
    color: theme.textMuted,
    lineHeight: 18,
    marginBottom: theme.space.xxs
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: theme.space.sm
  },
  stepNumber: {
    width: 20,
    ...theme.font.captionMedium,
    color: theme.primary
  },
  stepText: {
    flex: 1,
    ...theme.font.caption,
    color: theme.textSecondary,
    lineHeight: 18
  }
});
