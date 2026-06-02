export type ExpenseCategory =
  | 'Transport'
  | 'Accommodation'
  | 'Food'
  | 'Activities'
  | 'Shopping'
  | 'Other';

export interface Expense {
  id: string;
  tripId: string;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  date: string;
  createdAt: string;
}

export interface AddExpenseRequest {
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  date: string;
}

export interface BudgetSummary {
  expenses: Expense[];
  total: number;
  byCategory: { category: ExpenseCategory; total: number }[];
}
