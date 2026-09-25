import { ProcessingResult, MaintenanceNeed, TriggeredRule } from '../types';
import { highestSeverity, severityRank } from '../rules/engine';

export function determineMaintenanceNeed(pr: ProcessingResult, triggered: TriggeredRule[]): MaintenanceNeed {
  const sev = highestSeverity(triggered);
  const count = triggered.length;
  if (pr.overall === 'CRITICAL') {
    return {
      level: 'urgent',
      label: 'Urgent Maintenance',
      priority: 'IMMEDIATE',
      reason: 'One or more parameters have reached a critical threshold. Immediate maintenance is required to avoid failure or damage.'
    };
  }
  if (pr.overall === 'WARNING') {
    if (count >= 3 || (sev && severityRank(sev) >= 3)) {
      return {
        level: 'immediate',
        label: 'Immediate Inspection',
        priority: 'HIGH',
        reason: 'Multiple or high-severity abnormal parameters indicate an escalating risk that should be inspected soon.'
      };
    }
    return {
      level: 'preventive',
      label: 'Preventive Maintenance',
      priority: 'MEDIUM',
      reason: 'Parameters indicate developing motor stress. Preventive maintenance is recommended before the condition escalates.'
    };
  }
  if (count > 0) {
    return {
      level: 'routine',
      label: 'Routine Inspection',
      priority: 'LOW',
      reason: 'Minor deviations were observed; schedule a routine inspection during the next maintenance window.'
    };
  }
  return {
    level: 'none',
    label: 'No Maintenance Required',
    priority: 'LOW',
    reason: 'All monitored parameters are within acceptable limits. Continue routine monitoring.'
  };
}

export function conditionSummary(pr: ProcessingResult): string {
  const abnormal = Object.values(pr.params).filter((p) => p.level !== 'normal');
  if (abnormal.length === 0) return 'The equipment is operating within acceptable limits.';
  return `Condition assessed as ${pr.overall === 'CRITICAL' ? 'CRITICAL' : 'WARNING'} due to abnormal readings in ${abnormal.map((p) => p.key).join(', ')}.`;
}