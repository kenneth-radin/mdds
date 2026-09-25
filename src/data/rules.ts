import { DecisionRule } from '../types';

// Seed decision rules. scope ''all'' applies to every equipment type.
export const SEED_RULES: DecisionRule[] = [
  {
    id: 'R1',
    name: 'Overheating risk',
    description: 'Identify possible overheating when temperature reaches its critical threshold.',
    parameter: 'temperature',
    condition: { op: 'level', parameter: 'temperature', level: 'critical' },
    severity: 'high',
    scope: 'all',
    recommendation: 'Inspect cooling system, clean fins/ventilation, and check bearing friction for overheating.',
    enabled: true,
    editable: true
  },
  {
    id: 'R2',
    name: 'Bearing / mechanical problem',
    description: 'Identify a possible bearing or mechanical problem when vibration is critical.',
    parameter: 'vibration',
    condition: { op: 'level', parameter: 'vibration', level: 'critical' },
    severity: 'critical',
    scope: 'all',
    recommendation: 'Perform immediate inspection of bearings, couplings and rotor balance.',
    enabled: true,
    editable: true
  },
  {
    id: 'R3',
    name: 'Motor overload',
    description: 'Identify a possible overload when motor current exceeds the rated value plus tolerance.',
    parameter: 'current',
    condition: { op: 'level', parameter: 'current', level: 'critical' },
    severity: 'critical',
    scope: 'all',
    recommendation: 'Check for mechanical load increase, starter/contactor issues or winding fault; reduce load.',
    enabled: true,
    editable: true
  },
  {
    id: 'R4',
    name: 'Voltage instability',
    description: 'Flag voltage outside the acceptable supply band.',
    parameter: 'voltage',
    condition: { op: 'level', parameter: 'voltage', level: 'warning' },
    severity: 'medium',
    scope: 'all',
    recommendation: 'Verify supply voltage, check connections and power quality.',
    enabled: true,
    editable: true
  },
  {
    id: 'R5',
    name: 'Motor overload / overheating combo',
    description: 'High temperature together with high current indicates overload or cooling deficiency.',
    parameter: 'multiple',
    condition: {
      op: 'and',
      operands: [
        { op: 'level', parameter: 'temperature', level: 'warning' },
        { op: 'level', parameter: 'current', level: 'warning' }
      ]
    },
    severity: 'high',
    scope: 'all',
    recommendation: 'Inspect for mechanical overload and verify the motor cooling system.',
    enabled: true,
    editable: true
  },
  {
    id: 'R6',
    name: 'Mechanical / bearing trend',
    description: 'Elevated vibration with a rising temperature suggests a mechanical or bearing issue developing.',
    parameter: 'multiple',
    condition: {
      op: 'and',
      operands: [
        { op: 'level', parameter: 'vibration', level: 'warning' },
        { op: 'trend', parameter: 'temperature', direction: 'increasing' }
      ]
    },
    severity: 'high',
    scope: 'all',
    recommendation: 'Schedule bearing and thermal inspection within the maintenance window.',
    enabled: true,
    editable: true
  },
  {
    id: 'R7',
    name: 'Multi-parameter abnormality',
    description: 'Several parameters are abnormal; raise the maintenance priority for this equipment.',
    parameter: 'multiple',
    condition: {
      op: 'and',
      operands: [
        { op: 'level', parameter: 'temperature', level: 'warning' },
        { op: 'level', parameter: 'vibration', level: 'warning' }
      ]
    },
    severity: 'high',
    scope: 'all',
    recommendation: 'Escalate maintenance priority and perform an early inspection.',
    enabled: true,
    editable: true
  },
  {
    id: 'R8',
    name: 'Voltage excursion (critical)',
    description: 'Severe under/over voltage that can disturb motor torque and protection.',
    parameter: 'voltage',
    condition: { op: 'level', parameter: 'voltage', level: 'critical' },
    severity: 'high',
    scope: 'all',
    recommendation: 'Immediately verify the electrical supply and motor protection settings.',
    enabled: true,
    editable: true
  }
];