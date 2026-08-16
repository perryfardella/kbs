import ExcelJS from "exceljs";
import { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { TYPE_LABELS } from "@/lib/transactionLabels";

type ExpenseBreakdown = NonNullable<FunctionReturnType<typeof api.transactions.getExpenseBreakdown>>;
type RentalBreakdown = NonNullable<FunctionReturnType<typeof api.properties.getRentalBreakdown>>;
type LoanLedgerRange = NonNullable<FunctionReturnType<typeof api.transactions.getLoanLedgerRange>>;

const CURRENCY_FORMAT = '"$"#,##0.00;[Red]("$"#,##0.00)';

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

function styleHeader(worksheet: ExcelJS.Worksheet) {
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addExpenseSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: ExpenseBreakdown["personal"]["rows"]
) {
  const worksheet = workbook.addWorksheet(name);
  worksheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Description", key: "description", width: 32 },
    { header: "Type", key: "type", width: 26 },
    { header: "Category", key: "category", width: 24 },
    { header: "Amount", key: "amount", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Notes", key: "notes", width: 30 },
    { header: "Loan Impact", key: "loanImpact", width: 14, style: { numFmt: CURRENCY_FORMAT } },
  ];
  for (const row of rows) {
    worksheet.addRow({
      date: row.date,
      description: row.description,
      type: typeLabel(row.type),
      category: row.categoryName ?? "",
      amount: row.amount,
      notes: row.notes ?? "",
      loanImpact: row.shareholderLoanDelta !== 0 ? row.shareholderLoanDelta : "",
    });
  }
  styleHeader(worksheet);
}

function addRentalSheet(workbook: ExcelJS.Workbook, rows: RentalBreakdown["rows"]) {
  const worksheet = workbook.addWorksheet("Rental");
  worksheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Description", key: "description", width: 32 },
    { header: "Type", key: "type", width: 18 },
    { header: "Property", key: "property", width: 20 },
    { header: "Category", key: "category", width: 24 },
    { header: "Amount", key: "amount", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Notes", key: "notes", width: 30 },
  ];
  for (const row of rows) {
    worksheet.addRow({
      date: row.date,
      description: row.description,
      type: typeLabel(row.type),
      property: row.propertyName ?? "",
      category: row.categoryName ?? "",
      amount: row.amount,
      notes: row.notes ?? "",
    });
  }
  styleHeader(worksheet);
}

function addLoanSheet(workbook: ExcelJS.Workbook, loan: LoanLedgerRange) {
  const worksheet = workbook.addWorksheet("Loan Account");
  worksheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Description", key: "description", width: 32 },
    { header: "Type", key: "type", width: 26 },
    { header: "Amount", key: "amount", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Loan Delta", key: "delta", width: 14, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Running Balance", key: "balance", width: 16, style: { numFmt: CURRENCY_FORMAT } },
  ];
  worksheet.addRow({
    date: "",
    description: "Opening Balance",
    type: "",
    amount: "",
    delta: "",
    balance: loan.openingBalance,
  }).font = { italic: true };
  for (const entry of loan.entries) {
    worksheet.addRow({
      date: entry.date,
      description: entry.description,
      type: typeLabel(entry.type),
      amount: entry.amount,
      delta: entry.shareholderLoanDelta,
      balance: entry.runningBalance,
    });
  }
  styleHeader(worksheet);
}

function byDate<T extends { date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

export async function buildReportWorkbook({
  expenseBreakdown,
  rentalBreakdown,
  loanLedger,
}: {
  expenseBreakdown: ExpenseBreakdown;
  rentalBreakdown: RentalBreakdown;
  loanLedger: LoanLedgerRange;
}): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  addExpenseSheet(workbook, "Personal", byDate([...expenseBreakdown.personalIncome.rows, ...expenseBreakdown.personal.rows]));
  addExpenseSheet(workbook, "Business", byDate([...expenseBreakdown.businessIncome.rows, ...expenseBreakdown.business.rows]));
  addRentalSheet(workbook, rentalBreakdown.rows);
  addLoanSheet(workbook, loanLedger);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
