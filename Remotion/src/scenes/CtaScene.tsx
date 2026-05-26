import React from 'react';
import {AbsoluteFill} from 'remotion';
import {AnimatedHeading} from '../components/AnimatedHeading';
import {BrandBackground} from '../components/BrandBackground';
import {SceneImage} from '../components/SceneImage';
import type {LoanReminderCustomer} from '../data/sampleCustomer';

export const CtaScene = ({customer}: {customer: LoanReminderCustomer}) => {
  return (
    <BrandBackground>
      <AbsoluteFill>
        {/* Title at top: 140 */}
        <div
          style={{
            position: 'absolute',
            top: 140,
            left: 74,
            right: 74,
          }}
        >
          <AnimatedHeading eyebrow="Action required" tone="success">
            Clear your overdue amount today
          </AnimatedHeading>
        </div>

        {/* Tilted phone illustration using SceneImage */}
        <SceneImage
          src={customer.loanReminderAssets.ctaScene}
          width={380}
          height={480}
          top={380}
          left={74}
        />

        {/* Balance Card on the right */}
        <div
          style={{
            position: 'absolute',
            top: 400,
            left: 480,
            width: 526,
            background: 'rgba(255, 255, 255, 0.96)',
            border: '1.5px solid rgba(6, 63, 95, 0.12)',
            borderRadius: 16,
            boxShadow: '0 22px 52px rgba(6, 63, 95, 0.1)',
            padding: '34px 32px',
          }}
        >
          <div
            style={{
              color: '#607589',
              fontSize: 26,
              fontWeight: 850,
              lineHeight: 1.1,
              textTransform: 'uppercase',
            }}
          >
            Amount due
          </div>
          <div
            style={{
              color: '#0a9d58',
              fontSize: 66,
              fontWeight: 950,
              lineHeight: 1,
              marginTop: 14,
              overflowWrap: 'anywhere',
            }}
          >
            {customer.overdueAmount}
          </div>
          <div
            style={{
              color: '#17374c',
              fontSize: 26,
              fontWeight: 750,
              lineHeight: 1.25,
              marginTop: 18,
            }}
          >
            For {customer.loanType} account {customer.loanNumber}
          </div>
        </div>

        {/* Helper caption at top: 1040 */}
        <div
          style={{
            position: 'absolute',
            top: 1040,
            left: 74,
            right: 74,
            color: '#17374c',
            fontSize: 34,
            fontWeight: 850,
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          Use the secure options shown on this page to continue.
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
};
