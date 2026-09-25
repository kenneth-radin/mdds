import { DecisionRule, ProcessingResult, RuleCond, Severity, TriggeredRule, Equipment } from '../types';

export function severityRank(s: Severity): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[s];
}

export function evalCond(cond: RuleCond, pr: ProcessingResult): boolean {
  switch (cond.op) {
    case 'always':
      return true;
    case 'level':
      return pr.params[cond.parameter].level === cond.level;
    case 'compare': {
      const v = pr.params[cond.parameter].value;
      switch (cond.comparator) {
        case '<': return v < cond.value;
        case '>': return v > cond.value;
        case '<=': return v <= cond.value;
        case '>=': return v >= cond.value;
      }
      return false;
    }
    case 'and':
      return cond.operands.length > 0 && cond.operands.every((c) => evalCond(c, pr));
    case 'or':
      return cond.operands.length > 0 && cond.operands.some((c) => evalCond(c, pr));
    case 'trend':
      return pr.trends[cond.parameter].direction === cond.direction;
  }
  return false;
}

export function paramLevelNames(cond: RuleCond, pr: ProcessingResult): string[] {
  const out: string[] = [];
  const walk = (c: RuleCond) => {
    if (c.op === 'level') out.push(`${c.parameter} ${c.level}`);
    if (c.op === 'compare') out.push(`${c.parameter} ${c.comparator} ${c.value}`);
    if (c.op === 'trend') out.push(`${c.parameter} trend ${c.direction}`);
    if (c.op === 'and' || c.op === 'or') c.operands.forEach(walk);
  };
  walk(cond);
  return out;
}

export function evaluateRules(rules: DecisionRule[], pr: ProcessingResult, equipmentType: string): TriggeredRule[] {
  const triggered: TriggeredRule[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.scope !== 'all' && rule.scope !== equipmentType) continue;
    if (evalCond(rule.condition, pr)) {
      const facts = paramLevelNames(rule.condition, pr).join('; ');
      triggered.push({
        ruleId: rule.id,
        name: rule.name,
        severity: rule.severity,
        recommendation: rule.recommendation,
        explanation: rule.description + (facts ? ` (Symptom: ${facts}.)` : '')
      });
    }
  }
  triggered.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  return triggered;
}

export function highestSeverity(rules: TriggeredRule[]): Severity | null {
  if (rules.length === 0) return null;
  return rules.reduce((a, b) => (severityRank(b.severity) > severityRank(a.severity) ? b : a)).severity;
}