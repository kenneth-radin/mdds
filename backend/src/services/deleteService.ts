// Soft-delete a maintenance case with cascade:
//  - Alerts: unlink linkedMaintenanceCase → null
//  - TestingCases: null maintenanceCase
//  - FailureRecord / MaintenanceRecord: left untouched (no case-ref field)
//
// Requires admin role (JWT role check). Soft-delete only — never a hard remove.

import { MaintenanceCase } from '../models/MaintenanceCase';
import { Alert } from '../models/Alert';
import { TestingCase } from '../models/TestingCase';

export async function softDeleteMaintenanceCase(
  caseId: string,
  userRole: string
): Promise<{ success: boolean; message: string; case?: { _id: string; caseNumber: string; isDeleted: boolean; deletedAt: Date | null } }> {
  if (userRole !== 'admin') {
    return { success: false, message: '403 Forbidden: admin role required' };
  }

  const doc = await MaintenanceCase.findById(caseId);
  if (!doc) {
    return { success: false, message: '404 Not Found' };
  }

  if (doc.isDeleted) {
    return { success: false, message: '404 Not Found' };
  }

  // 1. Unlink linked alerts (linkedMaintenanceCase → null)
  await Alert.updateMany(
    { linkedMaintenanceCase: caseId },
    { $set: { linkedMaintenanceCase: null } }
  );

  // 2. Null the maintenanceCase ref on testing cases
  await TestingCase.updateMany(
    { maintenanceCase: caseId },
    { $set: { maintenanceCase: null } }
  );

  // 3. Soft-delete the case
  const updatedDoc = await MaintenanceCase.findByIdAndUpdate(caseId, {
    $set: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  }, { new: true });

  if (!updatedDoc) {
    return { success: false, message: '404 Not Found' };
  }

  return {
    success: true,
    message: 'Case soft-deleted successfully',
    case: {
      _id: updatedDoc._id.toString(),
      caseNumber: updatedDoc.caseNumber,
      isDeleted: updatedDoc.isDeleted,
      deletedAt: updatedDoc.deletedAt || null,
    },
  };
}
