import { C } from '../../lib/styles';
import { useRouter } from 'next/router';

export default function SettingsTab({ profile, isMobile }) {
  const router = useRouter();

  return (
    <div className="mb-main">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="mb-heading">Firm Settings</div>
          <div className="mb-sub">Configure your firm details, billing rates and banking information</div>
        </div>
        <button className="mb-btn" onClick={() => router.push('/settings')}>Open full settings →</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
        <div className="mb-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Firm Information</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['Firm Name', 'firm_name'], ['VAT Number', 'vat_number'], ['Phone', 'phone'], ['Email', 'email'], ['Website', 'website'], ['Address', 'address']].map(([label, key]) => (
              <div key={key}>
                <div className="mb-lbl">{label}</div>
                <div style={{ fontSize: 12, color: '#C8C8C8', background: '#0D0D0D', padding: '8px 10px', borderRadius: 5, border: '1px solid #1A1A1A' }}>
                  {profile?.[key] || <span style={{ color: '#333' }}>Not set — open full settings to configure</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0', marginBottom: 12 }}>Banking Details</div>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 12 }}>Displayed on all invoices sent to clients</div>
          {[['Bank Name', 'bank_name'], ['Account Number', 'bank_account'], ['Branch Code', 'bank_branch'], ['Default Rate (R/unit)', 'default_rate']].map(([label, key]) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <div className="mb-lbl">{label}</div>
              <div style={{ fontSize: 12, color: '#C8C8C8', background: '#0D0D0D', padding: '8px 10px', borderRadius: 5, border: '1px solid #1A1A1A' }}>
                {profile?.[key] || <span style={{ color: '#333' }}>Not set</span>}
              </div>
            </div>
          ))}
          <button className="mb-btn mb-btn-primary" style={{ marginTop: 8, width: '100%' }} onClick={() => router.push('/settings')}>Edit all settings →</button>
        </div>
      </div>
    </div>
  );
}
