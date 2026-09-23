import React, { useState } from 'react';
import { X, FileText, Printer, Copy, Check, Share2, MessageCircle, ArrowRight, Download, Calendar, Users, DollarSign } from 'lucide-react';
import { Trip, TripMember, Expense, MemberBalance, SettlementTransaction } from '../types/index.js';

interface ExportSummaryModalProps {
  trip: Trip;
  members: TripMember[];
  expenses: Expense[];
  balances: MemberBalance[];
  recommendations: SettlementTransaction[];
  onClose: () => void;
}

export const ExportSummaryModal: React.FC<ExportSummaryModalProps> = ({
  trip,
  members,
  expenses,
  balances,
  recommendations,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const totalCents = trip.total_expenses_cents || expenses.reduce((acc, e) => acc + e.amount_cents, 0);
  const totalFormatted = (totalCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });

  // Generate clean WhatsApp/Text summary
  const generateTextSummary = (): string => {
    let text = `📊 *TripSplit Expense Summary: ${trip.name}*\n`;
    if (trip.start_date) {
      text += `📅 Dates: ${trip.start_date}${trip.end_date ? ' - ' + trip.end_date : ''}\n`;
    }
    text += `💰 *Total Expenses: Rs. ${totalFormatted}*\n`;
    text += `👥 Members (${members.length}): ${members.map(m => m.user?.name).join(', ')}\n\n`;

    text += `*⚖️ Net Balances:*\n`;
    for (const b of balances) {
      const net = b.net_balance_cents / 100;
      if (net > 0) {
        text += `• ${b.user.name}: +Rs. ${net.toLocaleString()} (Receives back)\n`;
      } else if (net < 0) {
        text += `• ${b.user.name}: -Rs. ${Math.abs(net).toLocaleString()} (Owes)\n`;
      } else {
        text += `• ${b.user.name}: Settled (Rs. 0)\n`;
      }
    }

    text += `\n*🤝 Final Settlement Plan (Who pays whom):*\n`;
    if (recommendations.length === 0) {
      text += `🎉 All balances are settled up! No payments needed.\n`;
    } else {
      for (const rec of recommendations) {
        const amt = (rec.amount_cents / 100).toLocaleString();
        text += `👉 ${rec.from_user.name} pays ${rec.to_user.name}: Rs. ${amt}\n`;
      }
    }

    text += `\n*📋 Itemized Expenses (${expenses.length}):*\n`;
    for (const exp of expenses.slice(0, 15)) {
      const sub = exp.subcategory ? ` (${exp.subcategory})` : '';
      text += `• ${exp.title}${sub} - Rs. ${(exp.amount_cents / 100).toLocaleString()} (Paid by ${exp.payer?.name || 'Member'})\n`;
    }
    if (expenses.length > 15) {
      text += `• ...and ${expenses.length - 15} more items\n`;
    }

    text += `\n_Generated via TripSplit PWA_`;
    return text;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateTextSummary());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleWhatsAppShare = () => {
    const text = generateTextSummary();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto animate-slideUp flex flex-col max-h-[92vh]">
        {/* Modal Top Bar - Hidden when printing */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 print:hidden flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-brand-100 text-brand-700 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Trip Summary & PDF Report</h2>
              <p className="text-xs text-slate-500">{trip.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrintPDF}
              className="flex items-center space-x-1.5 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Download PDF / Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Sharing Buttons Banner - Hidden when printing */}
        <div className="px-6 py-3 bg-brand-50/70 border-b border-brand-100 flex flex-wrap items-center justify-between gap-2 print:hidden flex-shrink-0">
          <span className="text-xs font-bold text-brand-900">
            Share total breakdown with group:
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center space-x-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Group</span>
            </button>
            <button
              onClick={handleCopyText}
              className="flex items-center space-x-1.5 py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Summary</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 overflow-y-auto space-y-6 print:p-0 print:overflow-visible print:m-0 print:space-y-4" id="printable-report">
          {/* Document Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <span className="text-[11px] font-black tracking-widest uppercase text-brand-600">
                Official Trip Expense Report
              </span>
              <h1 className="text-2xl font-black text-slate-900 mt-0.5">
                {trip.name}
              </h1>
              {trip.description && (
                <p className="text-xs text-slate-500 mt-1 max-w-md">{trip.description}</p>
              )}
              <div className="flex items-center space-x-4 text-xs text-slate-500 mt-2 font-medium">
                {trip.start_date && (
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{trip.start_date}{trip.end_date ? ' to ' + trip.end_date : ''}</span>
                  </span>
                )}
                <span className="flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>{members.length} Members</span>
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                Total Group Expenses
              </span>
              <span className="text-2xl font-black text-slate-900">
                Rs. {totalFormatted}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Generated: {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Section 1: Final Settlement Plan */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <span>🤝 Settlement Instructions (How to Clear All Debts)</span>
            </h3>

            {recommendations.length === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 text-center">
                🎉 All member balances are fully settled! No payments are owed.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/70"
                  >
                    <div className="text-xs font-bold">
                      <span className="text-rose-700">{rec.from_user.name}</span>
                      <span className="text-slate-400 mx-1.5 font-normal">pays</span>
                      <span className="text-emerald-700">{rec.to_user.name}</span>
                    </div>
                    <span className="text-sm font-black text-slate-900">
                      Rs. {(rec.amount_cents / 100).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Member Balances Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              ⚖️ Member Balances Summary
            </h3>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-2.5 px-4">Member</th>
                    <th className="py-2.5 px-4 text-right">Total Paid</th>
                    <th className="py-2.5 px-4 text-right">Their Share</th>
                    <th className="py-2.5 px-4 text-right">Net Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balances.map(b => (
                    <tr key={b.user_id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-bold text-slate-800">
                        {b.user.name}
                        {b.role === 'OWNER' && (
                          <span className="ml-1.5 text-[9px] bg-amber-100 text-amber-800 uppercase px-1.5 py-0.5 rounded font-bold">
                            Owner
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                        Rs. {(b.total_paid_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                        Rs. {(b.total_share_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black">
                        <span
                          className={
                            b.net_balance_cents > 0
                              ? 'text-emerald-700'
                              : b.net_balance_cents < 0
                              ? 'text-rose-700'
                              : 'text-slate-500'
                          }
                        >
                          {b.net_balance_cents > 0 ? '+' : ''}
                          Rs. {(b.net_balance_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Itemized Expenses List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                📋 Itemized Expense Log ({expenses.length})
              </h3>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Expense & Category</th>
                    <th className="py-2.5 px-4">Paid By</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                        {exp.expense_date}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-slate-900">{exp.title}</div>
                        <div className="text-[11px] text-slate-500">
                          {exp.category}
                          {exp.subcategory ? ` • ${exp.subcategory}` : ''}
                          {exp.notes ? ` (${exp.notes})` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 font-medium">
                        {exp.payer?.name || 'Member'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                        Rs. {(exp.amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Document Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
            <span>TripSplit — Group Trip Expense Splitter PWA</span>
            <span>Accurate to the cent • Zero floating-point discrepancies</span>
          </div>
        </div>
      </div>
    </div>
  );
};
