import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {LoanOfferData, LoanOfferInteractiveTemplateProps} from './types';

const FONT_FAMILY = 'Inter, Poppins, Avenir Next, SF Pro Display, Arial, sans-serif';

const safeText = (value: unknown, fallback: string) => {
  if (value === null || value === undefined) return fallback;
  const cleaned = String(value).trim();
  return cleaned || fallback;
};

const toNumeric = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const formatIndian = (value: unknown, fallback = 'NA') => {
  const numeric = toNumeric(value);
  if (numeric === null) return safeText(value, fallback);
  return `₹ ${numeric.toLocaleString('en-IN')}`;
};

const isAvailable = (value: unknown) => {
  const cleaned = safeText(value, '').toLowerCase();
  return Boolean(cleaned && cleaned !== 'na' && cleaned !== 'null');
};

const buildRows = (offer: LoanOfferData) => {
  const tenures = ['24', '30', '36', '42', '48', '60'];
  const rows = tenures
    .map((tenure) => {
      const amount = offer[`month_${tenure}_loan_amount` as keyof LoanOfferData];
      const emi = offer[`emi_calculation${tenure}` as keyof LoanOfferData];
      return {
        tenure,
        amount,
        emi,
      };
    })
    .filter((row) => isAvailable(row.amount));

  if (rows.length > 0) return rows;

  return [
    {
      tenure: safeText(offer.max_tenure, '60'),
      amount: offer.max_loan_amount || '105000',
      emi: offer.max_emi || '3398',
    },
  ];
};

const getSelectedRow = (offer: LoanOfferData) => {
  const rows = buildRows(offer);
  const maxAmount = safeText(offer.max_loan_amount, safeText(rows[rows.length - 1]?.amount, '105000'));
  const maxTenure = safeText(offer.max_tenure, safeText(rows[rows.length - 1]?.tenure, '60'));
  return (
    rows.find(
      (row) =>
        safeText(row.amount, '') === maxAmount && safeText(row.tenure, '') === maxTenure
    ) ||
    rows.find((row) => safeText(row.amount, '') === maxAmount) ||
    rows[rows.length - 1]
  );
};

const Shell = ({children}: {children: React.ReactNode}) => (
  <AbsoluteFill
    style={{
      background: 'linear-gradient(180deg, #ffffff 0%, #f9f4fb 46%, #f3e7f6 100%)',
      color: '#1a062f',
      fontFamily: FONT_FAMILY,
      overflow: 'hidden',
    }}
  >
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(circle at 10% 8%, rgba(112, 32, 130, 0.15), transparent 34%), radial-gradient(circle at 90% 76%, rgba(74, 16, 92, 0.16), transparent 30%)',
      }}
    />
    {children}
  </AbsoluteFill>
);

const Intro = ({
  clientName,
}: {
  customerName: string;
  clientName: string;
  offer: LoanOfferData;
}) => (
  <Shell>
    <div style={{padding: '120px 80px 0', height: '100%', position: 'relative'}}>
      {/* Brand Header */}
      <div style={{fontSize: 48, fontWeight: 900, color: '#702082', textAlign: 'center'}}>
        {clientName}
      </div>

      {/* Congratulations Card Frame (Blank area for Applicant Name overlay) */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '5%',
          width: '90%',
          height: '28%',
          borderRadius: 44,
          background: '#ffffff',
          boxShadow: '0 20px 60px rgba(74, 16, 92, 0.05)',
          padding: '60px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{fontSize: 52, fontWeight: 950, color: '#702082'}}>
          Congratulations
        </div>
      </div>

      {/* Pre-approved Loan Card Frame (Blank area for amount overlay) */}
      <div
        style={{
          position: 'absolute',
          top: '48%',
          left: '10%',
          width: '80%',
          height: '24%',
          borderRadius: 44,
          background: 'linear-gradient(135deg, #4a105c, #702082)',
          padding: '50px 40px',
          textAlign: 'center',
          boxShadow: '0 30px 72px rgba(74, 16, 92, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{fontSize: 32, fontWeight: 850, color: '#ffffff', opacity: 0.86}}>
          Pre-approved loan up to
        </div>
      </div>
    </div>
  </Shell>
);

const Selector = ({
  customerName,
  offer,
}: {
  customerName: string;
  offer: LoanOfferData;
}) => {
  return (
    <Shell>
      <div style={{padding: '120px 80px 0', height: '100%', position: 'relative'}}>
        {/* Title & Subtitle */}
        <div style={{fontSize: 44, fontWeight: 900, color: '#702082'}}>
          Choose your loan offer
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 28,
            fontWeight: 800,
            color: '#7b6c86',
            overflowWrap: 'anywhere',
          }}
        >
          {customerName}, select amount and tenure
        </div>

        {/* Amount Pill Frame (Blank white pill) */}
        <div style={{position: 'absolute', top: '23%', left: '25.7%', fontSize: 26, fontWeight: 800, color: '#7b6c86'}}>
          Select Amount
        </div>
        <div
          style={{
            position: 'absolute',
            top: '28.62%',
            left: '25.7%',
            width: '58.6%',
            height: '5.2%',
            background: '#ffffff',
            borderRadius: 999,
            border: '2px solid #ebdcf0',
          }}
        />

        {/* Tenure Pill Frame (Blank white pill) */}
        <div style={{position: 'absolute', top: '43.8%', left: '25.7%', fontSize: 26, fontWeight: 800, color: '#7b6c86'}}>
          Select Tenure
        </div>
        <div
          style={{
            position: 'absolute',
            top: '49.4%',
            left: '25.7%',
            width: '58.6%',
            height: '5.2%',
            background: '#ffffff',
            borderRadius: 999,
            border: '2px solid #ebdcf0',
          }}
        />

        {/* Summary Card background and static labels */}
        <div
          style={{
            position: 'absolute',
            top: '61%',
            left: '10%',
            width: '80%',
            height: '24%',
            background: '#f6ebfb',
            borderRadius: 44,
            boxShadow: '0 16px 36px rgba(112, 32, 130, 0.06)',
          }}
        />

        <div style={{position: 'absolute', top: '65.908%', left: '15%', height: '5.5%', display: 'flex', alignItems: 'center', fontSize: 26, fontWeight: 800, color: '#7b6c86'}}>
          Amount
        </div>
        <div style={{position: 'absolute', top: '71.647%', left: '15%', height: '5.5%', display: 'flex', alignItems: 'center', fontSize: 26, fontWeight: 800, color: '#7b6c86'}}>
          Tenure
        </div>
        <div style={{position: 'absolute', top: '78.082%', left: '15%', height: '5.5%', display: 'flex', alignItems: 'center', fontSize: 26, fontWeight: 800, color: '#7b6c86'}}>
          EMI
        </div>
      </div>
    </Shell>
  );
};

const Confirmed = ({
  offer,
  contactDetails,
}: {
  offer: LoanOfferData;
  contactDetails: string;
}) => {
  const selected = getSelectedRow(offer);
  const phone = safeText(offer.cta_phone_number, contactDetails);

  return (
    <Shell>
      <div
        style={{
          height: '100%',
          padding: '120px 80px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            borderRadius: 50,
            backgroundColor: '#ffffff',
            boxShadow: '0 28px 78px rgba(6, 27, 47, 0.16)',
            padding: '80px 50px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{fontSize: 48, fontWeight: 900, color: '#702082'}}>
            Offer confirmed
          </div>
          <div style={{marginTop: 30, fontSize: 36, fontWeight: 950, lineHeight: 1.2, color: '#1a062f'}}>
            Our team will help you complete the next step
          </div>
          <div
            style={{
              marginTop: 60,
              width: '100%',
              borderRadius: 28,
              backgroundColor: '#f6ebfb',
              padding: '30px 24px',
              fontSize: 34,
              fontWeight: 900,
              color: '#1a062f',
            }}
          >
            {formatIndian(selected.amount)} · {safeText(selected.tenure, '60')} Months
          </div>
          <div
            style={{
              marginTop: 40,
              width: '100%',
              borderRadius: 999,
              background: 'linear-gradient(135deg, #4a105c, #702082)',
              color: '#ffffff',
              padding: '26px 28px',
              fontSize: 38,
              fontWeight: 950,
              overflowWrap: 'anywhere',
            }}
          >
            {phone}
          </div>
        </div>
      </div>
    </Shell>
  );
};

export const LoanOfferInteractiveTemplate = ({
  customerName = 'Customer',
  clientName = 'Finance Partner',
  contactDetails = '1800-555-999',
  loanOffer = {},
  stepBoundaries = [324, 660],
}: LoanOfferInteractiveTemplateProps) => {
  const frame = useCurrentFrame();
  const offer = {
    max_loan_amount: '105000',
    max_tenure: '60',
    max_emi: '3398',
    month_24_loan_amount: '75000',
    month_30_loan_amount: '90000',
    month_36_loan_amount: '105000',
    month_42_loan_amount: 'NA',
    month_48_loan_amount: 'NA',
    month_60_loan_amount: '105000',
    ...loanOffer,
  };

  const introEnd = stepBoundaries[0] ?? 324;
  const selectorEnd = stepBoundaries[1] ?? 660;

  if (frame < introEnd) {
    return (
      <Intro
        customerName={safeText(customerName, 'Customer')}
        clientName={safeText(clientName, 'Finance Partner')}
        offer={offer}
      />
    );
  }

  if (frame < selectorEnd) {
    return <Selector customerName={safeText(customerName, 'Customer')} offer={offer} />;
  }

  return <Confirmed offer={offer} contactDetails={safeText(contactDetails, '1800-555-999')} />;
};
