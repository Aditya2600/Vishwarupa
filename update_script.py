import re

with open("Frontend/src/pages/InteractiveLoanOffer.tsx", "r") as f:
    content = f.read()

# We want to replace everything from {/* Avail Now Pulsing Button */} down to the end of the return statement.
start_marker = "{/* Avail Now Pulsing Button */}"
end_marker = "    </main>\n  );\n}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx) + len(end_marker)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + """{/* Invisible Continue Button (Avail Now) */}
        {showAvail ? (
          <div
            onClick={() => void handleAvailNow()}
            style={{
              position: "absolute",
              bottom: "7%",
              left: "5%",
              width: "90%",
              height: "10%",
              zIndex: 30,
              cursor: "pointer",
            }}
          />
        ) : null}

        {/* Interactive Selector UI (HTML Overlay) */}
        {(showSelector || showSelectorsOverlay) && !confirmed && selectedRow ? (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
            {/* We position the controls card exactly where the video's card is. 
                Assuming top: 38% for the start of the white controls card in the video. */}
            <div style={{ position: 'absolute', top: '38%', left: '5%', width: '90%', pointerEvents: 'auto' }}>
              
              {/* Slider for Amount */}
              <div style={{ position: 'relative', width: '80%', margin: '0 auto', height: 40, display: 'flex', alignItems: 'center' }}>
                <input 
                  type="range"
                  min={0}
                  max={uniqueAmounts.length - 1}
                  value={uniqueAmounts.indexOf(selectedAmount)}
                  onChange={(e) => {
                    const nextAmount = uniqueAmounts[Number(e.target.value)];
                    const nextRow = rows.find(r => r.amount === nextAmount) ?? rows[0];
                    setSelectedAmount(nextAmount);
                    setSelectedTenure(nextRow.tenure);
                  }}
                  style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 20 }}
                />
                <div style={{ width: '100%', height: 10, backgroundColor: '#f3f4f6', borderRadius: 10, position: 'relative', pointerEvents: 'none' }}>
                  {(() => {
                    const pct = (uniqueAmounts.indexOf(selectedAmount) / Math.max(1, uniqueAmounts.length - 1)) * 100;
                    return (
                      <>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: '#7c3aed', borderRadius: 10 }} />
                        <div style={{ position: 'absolute', left: `${pct}%`, top: -8, width: 26, height: 26, backgroundColor: '#fff', borderRadius: '50%', border: '6px solid #7c3aed', transform: 'translateX(-50%)', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.3)' }} />
                        <div style={{ position: 'absolute', left: `${pct}%`, top: -60, background: 'linear-gradient(135deg, #9333ea, #6d28d9)', color: '#fff', padding: '8px 20px', borderRadius: 12, fontSize: 20, fontWeight: 700, transform: 'translateX(-50%)', boxShadow: '0 8px 16px rgba(124, 58, 237, 0.3)', whiteSpace: 'nowrap' }}>
                          {formatAmount(selectedAmount)}
                          <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 12, height: 12, backgroundColor: '#7c3aed' }} />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Min/Max Labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: 16, fontWeight: 500, width: '80%', margin: '15px auto 30px' }}>
                 <div>{formatAmount(uniqueAmounts[0])}</div>
                 <div>{formatAmount(uniqueAmounts[uniqueAmounts.length - 1])}</div>
              </div>

              {/* Tenure Pills */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '90%', margin: '40px auto 0' }}>
                {TENURES.filter(t => visibleTenures.some(r => r.tenure === t) || t === selectedTenure).map((t) => {
                  const isSelected = t === selectedTenure;
                  return (
                    <div 
                      key={t}
                      onClick={() => setSelectedTenure(t)}
                      style={{
                        flex: 1,
                        padding: '12px 0',
                        borderRadius: 12,
                        border: isSelected ? 'none' : '1px solid #e5e7eb',
                        background: isSelected ? 'linear-gradient(135deg, #9333ea, #6d28d9)' : '#fff',
                        color: isSelected ? '#fff' : '#4b5563',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 8px 16px rgba(124, 58, 237, 0.25)' : 'none',
                        pointerEvents: 'auto'
                      }}
                    >
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{t}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, opacity: isSelected ? 0.9 : 0.6 }}>Months</div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Loan Summary Display Overlay */}
            <div style={{ position: 'absolute', top: '70%', left: '10%', width: '80%', pointerEvents: 'none' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 18 }}>
                 <span style={{color: 'transparent'}}>Amount</span>
                 <span style={{ fontWeight: 700, color: '#111827' }}>{formatAmount(selectedAmount)}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 18 }}>
                 <span style={{color: 'transparent'}}>Tenure</span>
                 <span style={{ fontWeight: 700, color: '#111827' }}>{selectedTenure} Months</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, fontSize: 18 }}>
                 <span style={{color: 'transparent'}}>Interest Rate</span>
                 <span style={{ fontWeight: 700, color: '#111827' }}>10.5%</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                 <span style={{color: 'transparent'}}>Monthly EMI</span>
                 <span style={{ fontSize: 28, fontWeight: 800, color: '#7c3aed' }}>{formatAmount(selectedRow.emi)}</span>
               </div>
            </div>

            {/* Invisible Proceed Button */}
            <div
              onClick={() => void handleConfirm()}
              style={{
                position: "absolute",
                bottom: "5%",
                left: "5%",
                width: "90%",
                height: "10%",
                zIndex: 30,
                cursor: "pointer",
                pointerEvents: 'auto'
              }}
            />
          </div>
        ) : null}

        {/* Dynamic Confirmed Screen Overlay */}
        {confirmed && selectedRow ? (
          <div style={{ position: 'absolute', inset: 0, zIndex: 40, backgroundColor: '#f5eefc', display: 'flex', flexDirection: 'column', padding: '60px 30px' }}>
             <div style={{ backgroundColor: '#fff', borderRadius: 32, padding: '40px 20px', boxShadow: '0 20px 50px rgba(112, 32, 130, 0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.8)' }}>
                {/* Green Check */}
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #4ade80, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(22, 163, 74, 0.3)', marginBottom: 20 }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#1e1b4b', marginBottom: 12 }}>Offer Confirmed!</div>
                <div style={{ fontSize: 18, color: '#6b7280', fontWeight: 500, marginBottom: 30, textAlign: 'center' }}>Our team will help you complete the next steps</div>
                
                {/* Summary Row */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '20px 0', borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', marginBottom: 30 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e1b4b', marginBottom: 4 }}>{formatAmount(selectedRow.amount)}</div>
                    <div style={{ fontSize: 14, color: '#6b7280' }}>Loan Amount</div>
                  </div>
                  <div style={{ width: 1, backgroundColor: '#f3f4f6' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e1b4b', marginBottom: 4 }}>{selectedRow.tenure}</div>
                    <div style={{ fontSize: 14, color: '#6b7280' }}>Months</div>
                  </div>
                  <div style={{ width: 1, backgroundColor: '#f3f4f6' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e1b4b', marginBottom: 4 }}>{formatAmount(selectedRow.emi)}<span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>/mo</span></div>
                    <div style={{ fontSize: 14, color: '#6b7280' }}>EMI</div>
                  </div>
                </div>

                {/* What's next */}
                <div style={{ width: '100%', marginBottom: 30 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 20 }}>What's next?</div>
                  <div style={{ position: 'relative', paddingLeft: 30 }}>
                     <div style={{ position: 'absolute', left: 11, top: 10, bottom: 20, width: 2, backgroundColor: '#c084fc' }} />
                     {[
                       { title: "1. Document verification", desc: "Our team will verify your documents within 24 hours" },
                       { title: "2. Agreement signing", desc: "e-Sign the agreement securely from your device" },
                       { title: "3. Disbursal", desc: "Loan amount will be credited to your account" }
                     ].map((step, idx) => (
                       <div key={idx} style={{ display: 'flex', marginBottom: 24, position: 'relative' }}>
                          <div style={{ position: 'absolute', left: -29, top: 2, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', zIndex: 1 }}>
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          </div>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e1b4b', marginBottom: 4 }}>{step.title}</div>
                            <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.4 }}>{step.desc}</div>
                          </div>
                       </div>
                     ))}
                  </div>
                </div>

                {/* Call Button */}
                <div onClick={handleCall} style={{ width: '100%', padding: '20px 0', background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)', borderRadius: 20, color: '#fff', fontSize: 20, fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 12px 24px rgba(34, 197, 94, 0.25)', cursor: 'pointer' }}>
                  <svg style={{ marginRight: 12 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  Call {phoneNumber}
                  <svg style={{ marginLeft: 12 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
                
                {hasEnded ? (
                  <div onClick={() => void playFromStart()} style={{ marginTop: 16, cursor: 'pointer', color: '#6b7280', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                    <svg style={{ marginRight: 8 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6"></path><path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path></svg>
                    Replay offer
                  </div>
                ) : null}
             </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
"""
    with open("Frontend/src/pages/InteractiveLoanOffer.tsx", "w") as f:
        f.write(new_content)
    print("Successfully replaced.")
else:
    print("Could not find markers.")
