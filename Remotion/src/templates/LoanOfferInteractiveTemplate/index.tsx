import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
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
      background:
        'linear-gradient(180deg, #ffffff 0%, #f9f4fb 46%, #f3e7f6 100%)',
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

const PhoneFrame = ({children}: {children: React.ReactNode}) => (
  <div
    style={{
      position: 'absolute',
      inset: '84px 68px',
      borderRadius: 58,
      border: '16px solid #102033',
      backgroundColor: '#f8fbff',
      overflow: 'hidden',
      boxShadow: '0 46px 110px rgba(6, 27, 47, 0.25)',
    }}
  >
    <div
      style={{
        height: 58,
        padding: '0 38px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#102033',
        fontSize: 22,
        fontWeight: 900,
      }}
    >
      <span>9:41</span>
      <span>5G 100%</span>
    </div>
    {children}
  </div>
);

const PulseButton = ({
  label,
  sublabel,
  bottom = 92,
}: {
  label: string;
  sublabel?: string;
  bottom?: number;
}) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame % 75, [0, 55, 75], [1, 1.18, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom,
        transform: 'translateX(-50%)',
        width: 680,
        height: 142,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          backgroundColor: '#4a105c',
          opacity: 0.18,
          transform: `scale(${pulse})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 10,
          borderRadius: 999,
          background: 'linear-gradient(180deg, #9b2fb2, #702082)',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 22px 42px rgba(112, 32, 130, 0.34)',
        }}
      >
        <div style={{fontSize: 38, fontWeight: 950, lineHeight: 1}}>{label}</div>
        {sublabel ? (
          <div style={{marginTop: 8, fontSize: 20, fontWeight: 800, opacity: 0.88}}>
            {sublabel}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const Intro = ({
  customerName,
  clientName,
  offer,
}: {
  customerName: string;
  clientName: string;
  offer: LoanOfferData;
}) => (
  <Shell>
    <PhoneFrame>
      <div style={{padding: '54px 42px 0'}}>
        <div style={{fontSize: 30, fontWeight: 900, color: '#702082'}}>
          {clientName}
        </div>
        <div
          style={{
            marginTop: 54,
            color: '#1a062f',
            fontSize: 60,
            fontWeight: 950,
            lineHeight: 1.05,
            textAlign: 'center',
            overflowWrap: 'anywhere',
          }}
        >
          Congratulations
          <br />
          {customerName}
        </div>
        <div
          style={{
            margin: '70px auto 0',
            width: 700,
            borderRadius: 34,
            background: 'linear-gradient(135deg, #4a105c, #702082)',
            color: '#ffffff',
            padding: '38px 34px',
            textAlign: 'center',
            boxShadow: '0 30px 72px rgba(74, 16, 92, 0.28)',
          }}
        >
          <div style={{fontSize: 26, fontWeight: 850, opacity: 0.86}}>Pre-approved loan up to</div>
          <div style={{marginTop: 8, fontSize: 76, fontWeight: 950}}>
            {formatIndian(offer.max_loan_amount)}
          </div>
        </div>
      </div>
    </PhoneFrame>
  </Shell>
);

const Selector = ({
  customerName,
}: {
  customerName: string;
}) => {
  return (
    <Shell>
      <PhoneFrame>
        <div style={{padding: '42px 42px 0'}}>
          <div style={{fontSize: 28, fontWeight: 900, color: '#702082'}}>
            Choose your loan offer
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 42,
              fontWeight: 950,
              lineHeight: 1.08,
              overflowWrap: 'anywhere',
            }}
          >
            {customerName}, select amount and tenure
          </div>
        </div>
      </PhoneFrame>
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
      <PhoneFrame>
        <div
          style={{
            height: '100%',
            padding: '94px 48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              borderRadius: 44,
              backgroundColor: '#ffffff',
              boxShadow: '0 28px 78px rgba(6, 27, 47, 0.16)',
              padding: '54px 42px',
              textAlign: 'center',
            }}
          >
            <div style={{fontSize: 30, fontWeight: 900, color: '#702082'}}>
              Offer confirmed
            </div>
            <div style={{marginTop: 18, fontSize: 60, fontWeight: 950, lineHeight: 1.04}}>
              Our team will help you complete the next step
            </div>
            <div
              style={{
                marginTop: 42,
                borderRadius: 28,
                backgroundColor: '#f6ebfb',
                padding: '28px 24px',
                fontSize: 30,
                fontWeight: 900,
                color: '#1a062f',
              }}
            >
              {formatIndian(selected.amount)} · {safeText(selected.tenure, '60')} Months
            </div>
            <div
              style={{
                marginTop: 30,
                borderRadius: 999,
                background: 'linear-gradient(135deg, #4a105c, #702082)',
                color: '#ffffff',
                padding: '26px 28px',
                fontSize: 36,
                fontWeight: 950,
                overflowWrap: 'anywhere',
              }}
            >
              {phone}
            </div>
          </div>
        </div>
      </PhoneFrame>
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
    return <Selector customerName={safeText(customerName, 'Customer')} />;
  }

  return <Confirmed offer={offer} contactDetails={safeText(contactDetails, '1800-555-999')} />;
};

