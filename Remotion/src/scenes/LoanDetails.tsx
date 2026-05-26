import React from 'react';
import {AbsoluteFill} from 'remotion';
import {AnimatedHeading} from '../components/AnimatedHeading';
import {BrandBackground} from '../components/BrandBackground';
import {InfoBox} from '../components/InfoBox';
import {PhoneMockup} from '../components/PhoneMockup';
import type {LoanReminderCustomer} from '../data/sampleCustomer';

export const LoanDetails = ({customer}: {customer: LoanReminderCustomer}) => {
  return (
    <BrandBackground variant="calm">
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '150px 74px 90px',
        }}
      >
        <AnimatedHeading eyebrow="Important update">
          Dear {customer.customerName}
        </AnimatedHeading>
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
            marginTop: 64,
            width: '100%',
          }}
        >
          <PhoneMockup width={560}>
            <div
              style={{
                color: '#d9f7ff',
                fontSize: 24,
                fontWeight: 900,
                lineHeight: 1.2,
                marginBottom: 22,
                textAlign: 'center',
              }}
            >
              Loan Summary
            </div>
            <div style={{display: 'grid', gap: 16}}>
              <InfoBox label="Loan Type" value={customer.loanType} delay={8} />
              <InfoBox
                label="Loan Number"
                value={customer.loanNumber}
                delay={18}
              />
              <InfoBox
                label="Overdue Amount"
                value={customer.overdueAmount}
                highlight
                delay={28}
              />
            </div>
          </PhoneMockup>
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
};
