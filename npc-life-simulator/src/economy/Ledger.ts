export type SpendCategory =
  | 'rent'
  | 'mortgage'
  | 'utilities'
  | 'food'
  | 'dining'
  | 'transport'
  | 'clothing'
  | 'leisure'
  | 'health'
  | 'interest'
  | 'lifestyle'
  | 'investment';

export type IncomeCategory = 'salary' | 'pension' | 'benefits' | 'dividend' | 'inheritance' | 'divine';

export const SPEND_LABEL: Record<SpendCategory, string> = {
  rent: 'Miete',
  mortgage: 'Kredit & Instandhaltung',
  utilities: 'Nebenkosten',
  food: 'Lebensmittel',
  dining: 'Gastronomie',
  transport: 'Transport',
  clothing: 'Kleidung',
  leisure: 'Freizeit',
  health: 'Gesundheit',
  interest: 'Zinsen',
  lifestyle: 'Sonstige Lebenshaltung',
  investment: 'Investitionen',
};

export const INCOME_LABEL: Record<IncomeCategory, string> = {
  salary: 'Löhne & Gehälter',
  pension: 'Renten',
  benefits: 'Sozialleistungen',
  dividend: 'Gewinnausschüttungen',
  inheritance: 'Erbschaften',
  divine: 'Göttliche Eingriffe',
};

/**
 * City-wide money flows. Every euro the population spends or receives is booked
 * here, which is what makes the household balance verifiable instead of a guess.
 */
export class Ledger {
  spend: Record<SpendCategory, number>;
  income: Record<IncomeCategory, number>;
  /** Snapshot of the previous month, used by the economy panel. */
  lastMonthSpend: Record<SpendCategory, number>;
  lastMonthIncome: Record<IncomeCategory, number>;

  constructor() {
    this.spend = emptySpend();
    this.income = emptyIncome();
    this.lastMonthSpend = emptySpend();
    this.lastMonthIncome = emptyIncome();
  }

  addSpend(cat: SpendCategory, amount: number): void {
    if (amount > 0) this.spend[cat] += amount;
  }

  addIncome(cat: IncomeCategory, amount: number): void {
    if (amount > 0) this.income[cat] += amount;
  }

  totalSpend(): number {
    let t = 0;
    for (const k in this.spend) t += this.spend[k as SpendCategory];
    return t;
  }

  totalIncome(): number {
    let t = 0;
    for (const k in this.income) t += this.income[k as IncomeCategory];
    return t;
  }

  /** Called at month end: the running totals become last month's figures. */
  rollMonth(): void {
    this.lastMonthSpend = this.spend;
    this.lastMonthIncome = this.income;
    this.spend = emptySpend();
    this.income = emptyIncome();
  }
}

function emptySpend(): Record<SpendCategory, number> {
  return {
    rent: 0, mortgage: 0, utilities: 0, food: 0, dining: 0, transport: 0,
    clothing: 0, leisure: 0, health: 0, interest: 0, lifestyle: 0, investment: 0,
  };
}

function emptyIncome(): Record<IncomeCategory, number> {
  return { salary: 0, pension: 0, benefits: 0, dividend: 0, inheritance: 0, divine: 0 };
}

/** Maps an action's price category to a ledger bucket. */
export const PRICE_TO_SPEND: Record<string, SpendCategory> = {
  food: 'food',
  rent: 'rent',
  transport: 'transport',
  dining: 'dining',
  clothing: 'clothing',
  entertainment: 'leisure',
  electronics: 'clothing',
  health: 'health',
  education: 'leisure',
};
