import type { components } from '../generated/api';

export type Expense = Required<components['schemas']['Expense']>;
export type ExpenseCategory = components['schemas']['ExpenseCategory'];
export type AddExpenseRequest = components['schemas']['AddExpenseCommand'];
export type BudgetSummary = components['schemas']['BudgetSummaryResponse'];
export type CategoryTotal = components['schemas']['CategoryTotal'];
