export type LoanOfferData = {
  max_loan_amount?: string | number;
  max_tenure?: string | number;
  max_emi?: string | number;
  loan_id?: string;
  cta_phone_number?: string;
  month_24_loan_amount?: string | number;
  month_30_loan_amount?: string | number;
  month_36_loan_amount?: string | number;
  month_42_loan_amount?: string | number;
  month_48_loan_amount?: string | number;
  month_60_loan_amount?: string | number;
  emi_calculation24?: string | number;
  emi_calculation30?: string | number;
  emi_calculation36?: string | number;
  emi_calculation42?: string | number;
  emi_calculation48?: string | number;
  emi_calculation60?: string | number;
};

export type LoanOfferInteractiveTemplateProps = {
  customerName?: string;
  clientName?: string;
  contactDetails?: string;
  loanOffer?: LoanOfferData;
  stepBoundaries?: number[];
  interactiveBackgroundColor?: string;
  interactiveCtaColor?: string;
};

