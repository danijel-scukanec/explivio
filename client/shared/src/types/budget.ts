import type { components } from '../generated/api';

export type ExpenseResponse = components['schemas']['ExpenseResponse'];
// F25: an expense as the budget summary now returns it (carries the converted AmountInBase and any
// split shares). Kept named `Expense` for the UI, which treats this as "an expense".
export type Expense = ExpenseResponse;
export type ExpenseCategory = components['schemas']['ExpenseCategory'];
export type AddExpenseRequest = components['schemas']['AddExpenseCommand'];
export type BudgetSummary = components['schemas']['BudgetSummaryResponse'];
export type CategoryTotal = components['schemas']['CategoryTotal'];
// F25: original per-currency subtotal (before conversion to the trip base currency).
export type CurrencyTotal = components['schemas']['CurrencyTotal'];
export type ExpenseShareInput = components['schemas']['ExpenseShareInput'];
// F25: settle-up balances across a trip's split expenses.
export type BudgetBalances = components['schemas']['BudgetBalancesResponse'];
export type MemberBalance = components['schemas']['MemberBalance'];
export type Settlement = components['schemas']['Settlement'];
