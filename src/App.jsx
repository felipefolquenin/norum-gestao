import React, { useState, useEffect, useCallback } from "react";
import { supabase, supabaseConfigurado } from "./supabase.js";

// ============================================================================
// NORUM Engenharia — Sistema de Gestão de Condomínios
// Identidade baseada no Instagram @norum_engenharia:
//   azul-marinho (marca) + cores de serviço (água/manutenção/elétrica/
//   incêndio/sustentabilidade). Tema claro glass, sidebar vertical, animações.
// Persistência: window.storage (protótipo). Produção: PostgreSQL (norum-schema.sql).
// ============================================================================

const NAVY = "#12325B";
const NAVY_DK = "#0C2340";
const CIANO = "#28B6E8";
const LARANJA = "#F08A24";
const AMARELO = "#F5B921";
const VERMELHO = "#E5584F";
const VERDE = "#2ED18F";
const INK = "#E6EEF9";            // texto principal claro
const MUTED = "#7E93B4";          // texto secundário
const GLASS = "rgba(18,34,58,0.55)";   // cartão de vidro escuro
const LINE = "rgba(127,175,232,0.14)"; // divisórias sutis
const CARD_SOLID = "#0E2038";     // fundo de cartões sólidos/modais
const BG_BASE = "#061626";        // fundo base do app
const TITULO = "#DCE9FB";          // títulos e destaques de texto

const TIPOS_ITEM = {
  extintor: { label: "Extintor", validadeMeses: 12, cod: "EXT", cor: VERMELHO },
  caixa_gordura: { label: "Caixa de gordura", validadeMeses: 6, cod: "CXG", cor: LARANJA },
  caixa_dagua: { label: "Reservatório de água", validadeMeses: 6, cod: "RSV", cor: CIANO },
};
const STATUS_NOTA = {
  nao_emitida: { label: "Nota não emitida · pgto pendente", cor: MUTED },
  emitida_nao_paga: { label: "Nota emitida · pgto pendente", cor: AMARELO },
  paga: { label: "Pago", cor: VERDE },
};
// Valor efetivo de um serviço: o real (se concluído/informado), senão o estimado
const valorEfetivo = (s) => (s.valor > 0 ? s.valor : s.valorEstimado || 0);

// ---------------------------------------------------------------------------
// Gera o PDF do orçamento: abre uma janela com o documento formatado na
// identidade oficial da NORUM e chama a impressão (o usuário escolhe
// "Salvar como PDF"). Não depende de biblioteca externa.
// ---------------------------------------------------------------------------
const NORUM_AZUL = "#2C4466";
function gerarPdfOrcamento(orc, linhas, cliente) {
  const total = totalOrc(linhas);
  const venc = addDias(orc.dataEmissao, orc.validadeDias || 15);
  const num = "ORC-" + String(orc.numero || 0).padStart(4, "0");
  const linhasHtml = linhas.map((l) => `
    <tr>
      <td style="padding:10px 10px;border:1px solid #c8d0da">${escapeHtml(l.descricao)}</td>
      <td style="padding:10px 10px;border:1px solid #c8d0da;text-align:center">${l.quantidade}</td>
      <td style="padding:10px 10px;border:1px solid #c8d0da;text-align:right">${brl(l.valorUnitario)}</td>
      <td style="padding:10px 10px;border:1px solid #c8d0da;text-align:right;font-weight:700">${brl((l.quantidade || 0) * (l.valorUnitario || 0))}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${num} - NORUM Engenharia</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#0F0F0F; margin:0; font-size:12.5px; }
  .pag { width:210mm; min-height:297mm; padding:16mm 16mm 0 16mm; margin:auto; position:relative;
         display:flex; flex-direction:column; background:#fff; }
  .topo { text-align:center; }
  .marca { font-size:34px; font-weight:bold; letter-spacing:10px; color:#0F0F0F; margin-top:6px; }
  .tag { font-size:9.5px; letter-spacing:3px; color:${NORUM_AZUL}; font-weight:bold; margin-top:3px; line-height:1.5; }
  .faixa { background:${NORUM_AZUL}; color:#fff; padding:8px 14px; margin-top:22px;
           font-size:13px; font-weight:bold; letter-spacing:2px; display:flex; justify-content:space-between; }
  .dados { display:flex; gap:26px; margin-top:16px; }
  .rot { font-size:9px; letter-spacing:1.5px; color:#7a8598; text-transform:uppercase; font-weight:bold; }
  .val { font-size:13px; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-top:18px; }
  th { background:${NORUM_AZUL}; color:#fff; padding:9px 10px; text-align:left;
       font-size:10.5px; letter-spacing:1px; border:1px solid ${NORUM_AZUL}; }
  .tot td { background:${NORUM_AZUL}; color:#fff; padding:10px; font-size:14px; font-weight:bold; border:1px solid ${NORUM_AZUL}; }
  .obs { margin-top:18px; font-size:12px; white-space:pre-wrap; line-height:1.5; }
  .cred { margin-top:auto; padding-top:26px; font-size:10.5px; font-weight:bold; line-height:1.6; }
  .assin { margin-top:30px; }
  .assin .rotulo { font-size:9px; letter-spacing:1.5px; color:#7a8598; text-transform:uppercase; font-weight:bold; }
  .assin .espaco { height:58px; }
  .assin .linha { border-top:1.2px solid #0F0F0F; width:360px; }
  .assin .txt { font-style:italic; font-size:12.5px; margin-top:6px; }
  .assin .campos { display:flex; gap:26px; width:360px; margin-top:14px; font-size:10px; color:#7a8598; }
  .assin .campos div { flex:1; border-top:1px solid #b9c2cf; padding-top:4px; letter-spacing:1px; }
  .rodape { margin:26px -16mm 0 -16mm; background:${NORUM_AZUL}; color:#fff;
            padding:14px 16mm; display:flex; justify-content:space-between; align-items:center; font-size:10.5px; letter-spacing:1px; }
  .site { text-align:center; font-weight:bold; letter-spacing:2px; }
  @media print { .noprint { display:none; } .pag { margin:0; } }
</style></head><body>
<div class="pag">

  <div class="topo">
    <svg width="300" viewBox="0 0 1080 696.5" xmlns="http://www.w3.org/2000/svg">${LOGO_COMPLETA}</svg>
  </div>

  <div class="faixa"><span>ORÇAMENTO ${num}</span><span>${fmtData(orc.dataEmissao)}</span></div>

  <div class="dados">
    <div style="flex:1">
      <div class="rot">Cliente</div>
      <div class="val" style="font-weight:bold">${escapeHtml(cliente.nome || "-")}</div>
      ${cliente.endereco ? `<div class="val" style="font-size:11.5px;color:#4a5568">${escapeHtml(cliente.endereco)}</div>` : ""}
      ${cliente.sindico ? `<div class="val" style="font-size:11.5px;color:#4a5568">Responsável: ${escapeHtml(cliente.sindico)}</div>` : ""}
    </div>
    <div style="width:150px">
      <div class="rot">Validade da proposta</div>
      <div class="val">${fmtData(venc)}</div>
    </div>
  </div>

  <div style="margin-top:14px">
    <div class="rot">Objeto</div>
    <div class="val" style="font-weight:bold;font-size:14px">${escapeHtml(orc.titulo)}</div>
  </div>

  <table>
    <thead><tr>
      <th>DESCRIÇÃO DOS SERVIÇOS</th>
      <th style="width:62px;text-align:center">QTD.</th>
      <th style="width:106px;text-align:right">UNITÁRIO</th>
      <th style="width:116px;text-align:right">TOTAL</th>
    </tr></thead>
    <tbody>${linhasHtml}
      <tr class="tot"><td colspan="3" style="text-align:right">VALOR TOTAL</td><td style="text-align:right">${brl(total)}</td></tr>
    </tbody>
  </table>

  ${orc.observacoes ? `<div class="obs"><div class="rot">Observações</div>${escapeHtml(orc.observacoes)}</div>` : ""}

  <div class="cred">
    Empresa registrada no CREA-PR sob o número 75338<br>
    Licença ambiental nº de documento 233043, validade 03/05/2031
    ${orc.dadosContratante ? `<br>${escapeHtml(orc.dadosContratante).replace(/\n/g, "<br>")}` : ""}
  </div>

  <div class="assin">
    <div class="rotulo">Assinatura</div>
    <div class="espaco"></div>
    <div class="linha"></div>
    <div class="txt">Orçamento aceito pelos responsáveis.</div>
    <div class="campos">
      <div>NOME LEGÍVEL</div>
      <div>DATA</div>
    </div>
  </div>

  <div class="rodape">
    <span>engenharia@norum.com.br</span>
    <span class="site">WWW.NORUM.COM.BR</span>
    <span>(42) 9 98814-7090</span>
  </div>
</div>

<div class="noprint" style="text-align:center;margin:22px 0 40px">
  <button onclick="window.print()" style="background:${NORUM_AZUL};color:#fff;border:none;padding:12px 26px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer">
    Salvar como PDF / Imprimir
  </button>
</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("O navegador bloqueou a janela. Libere os pop-ups para este site e tente de novo."); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { try { win.print(); } catch (e) {} }, 500);
}
function escapeHtml(t) {
  return String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
const addDias = (iso, d) => { const x = new Date(iso); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

const STATUS_ORC = {
  rascunho: { label: "Rascunho", cor: MUTED },
  enviado:  { label: "Enviado ao cliente", cor: CIANO },
  aprovado: { label: "Aprovado", cor: VERDE },
  recusado: { label: "Recusado", cor: VERMELHO },
};
// Soma dos itens de um orçamento
const totalOrc = (itens) => (itens || []).reduce((t, i) => t + (i.quantidade || 0) * (i.valorUnitario || 0), 0);

const uid = () => Math.random().toString(36).slice(2, 10);
const AVULSO = "__avulso__"; // cliente genérico para serviços fora de condomínio
const hoje = () => new Date().toISOString().slice(0, 10);
const addMeses = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x.toISOString().slice(0, 10); };
const diasAte = (d) => Math.round((new Date(d) - new Date(hoje())) / 86400000);
const fmtData = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------------------------------------------------------------------------
// Camada de dados — Supabase. Converte entre o formato do app (camelCase) e
// as colunas do banco (snake_case). O condomínio avulso não é uma linha real:
// no banco, condominio_id fica nulo e cliente_avulso guarda o nome.
// ---------------------------------------------------------------------------
const nuloSeAvulso = (condId) => (condId === AVULSO ? null : condId);

// Condomínios
const condDeLinha = (r) => ({ id: r.id, nome: r.nome, endereco: r.endereco || "", sindico: r.sindico || "", telefone: r.telefone || "", administradora: r.administradora || "" });
const condParaLinha = (c) => ({ nome: c.nome, endereco: c.endereco || null, sindico: c.sindico || null, telefone: c.telefone || null, administradora: c.administradora || null });

// Itens
const itemDeLinha = (r) => ({ id: r.id, condId: r.condominio_id || AVULSO, clienteAvulso: r.cliente_avulso || "", tipo: r.tipo, local: r.local, ultima: r.ultima_manutencao, validade: r.validade });
const itemParaLinha = (i) => ({ condominio_id: nuloSeAvulso(i.condId), cliente_avulso: i.condId === AVULSO ? (i.clienteAvulso || "Avulso") : null, tipo: i.tipo, local: i.local, periodicidade_meses: TIPOS_ITEM[i.tipo].validadeMeses, ultima_manutencao: i.ultima, validade: i.validade });

// Serviços
const servDeLinha = (r) => ({ id: r.id, condId: r.condominio_id || AVULSO, clienteAvulso: r.cliente_avulso || "", titulo: r.titulo, data: r.data_agendada, valorEstimado: Number(r.valor_estimado || 0), valor: Number(r.valor), executadoEm: r.executado_em || "", status: r.status_nota, nfNumero: r.nf_numero || "", pgtoData: r.pago_em || "" });
const servParaLinha = (s) => ({ condominio_id: nuloSeAvulso(s.condId), cliente_avulso: s.condId === AVULSO ? (s.clienteAvulso || "Avulso") : null, titulo: s.titulo, data_agendada: s.data, valor_estimado: s.valorEstimado || 0, valor: s.valor || 0, executado_em: s.executadoEm || null, status_nota: s.status, nf_numero: s.nfNumero || null, nf_emitida_em: s.status !== "nao_emitida" ? (s.nfEmitidaEm || s.executadoEm || s.data || hoje()) : null, pago_em: s.status === "paga" ? (s.pgtoData || s.executadoEm || s.data || hoje()) : null });

// Orçamentos
const orcDeLinha = (r) => ({ id: r.id, numero: r.numero, condId: r.condominio_id || AVULSO, clienteAvulso: r.cliente_avulso || "", titulo: r.titulo, dataEmissao: r.data_emissao, validadeDias: r.validade_dias, observacoes: r.observacoes || "", dadosContratante: r.dados_contratante || "", status: r.status, servicoId: r.servico_id || "" });
const orcParaLinha = (o) => ({ condominio_id: nuloSeAvulso(o.condId), cliente_avulso: o.condId === AVULSO ? (o.clienteAvulso || "Avulso") : null, titulo: o.titulo, data_emissao: o.dataEmissao, validade_dias: o.validadeDias || 15, observacoes: o.observacoes || null, dados_contratante: o.dadosContratante || null, status: o.status || "rascunho" });
const orcItemDeLinha = (r) => ({ id: r.id, orcId: r.orcamento_id, descricao: r.descricao, quantidade: Number(r.quantidade), valorUnitario: Number(r.valor_unitario), ordem: r.ordem });

async function carregarTudo() {
  // Tempo limite: em obra com sinal fraco, a espera não pode ser infinita
  const limite = new Promise((_, rej) =>
    setTimeout(() => rej(new Error("Sem resposta do servidor. Verifique sua conexão.")), 15000)
  );
  return Promise.race([buscarDados(), limite]);
}

async function buscarDados() {
  const [c, i, s, o, oi] = await Promise.all([
    supabase.from("condominios").select("*").order("nome"),
    supabase.from("itens_monitorados").select("*"),
    supabase.from("servicos").select("*"),
    supabase.from("orcamentos").select("*").order("numero", { ascending: false }),
    supabase.from("orcamento_itens").select("*").order("ordem"),
  ]);
  if (c.error || i.error || s.error) throw (c.error || i.error || s.error);
  return {
    condominios: (c.data || []).map(condDeLinha),
    itens: (i.data || []).map(itemDeLinha),
    servicos: (s.data || []).map(servDeLinha),
    // orçamentos podem não existir ainda (antes da migração 005) — o app não quebra:
    // se a tabela não existir, o erro é ignorado e a lista fica vazia
    orcamentos: o.error ? [] : (o.data || []).map(orcDeLinha),
    orcItens: oi.error ? [] : (oi.data || []).map(orcItemDeLinha),
  };
}

function Badge({ children, cor }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "#fff", background: cor, whiteSpace: "nowrap" }}>{children}</span>;
}
function TipoSelo({ tipo }) {
  const t = TIPOS_ITEM[tipo];
  return <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, padding: "2px 7px", borderRadius: 6, color: t.cor, background: `${t.cor}18`, border: `1px solid ${t.cor}44` }}>{t.cod}</span>;
}
function ItemStatus({ validade }) {
  const d = diasAte(validade);
  let cor = VERDE, txt = `Regular · ${d} dias`;
  if (d < 0) { cor = VERMELHO; txt = `Vencido há ${Math.abs(d)} dias`; }
  else if (d <= 30) { cor = AMARELO; txt = `Vence em ${d} dias`; }
  return <Badge cor={cor}>{txt}</Badge>;
}
// ---------------------------------------------------------------------------
// Logo oficial NORUM — vetor extraído do arquivo original da marca.
// LOGO_SIMBOLO: octógono com o N (uso em ícone). LOGO_COMPLETA: marca completa
// com wordmark e assinatura (uso em documentos).
// ---------------------------------------------------------------------------
const AZUL_LOGO = "#2A4266";
const LOGO_SIMBOLO = `<path fill="#2A4266" d="M 611.617188 132.738281 L 611.617188 243.96875 L 583.125 272.019531 L 506.410156 193.113281 L 506.410156 260.265625 L 468.351562 260.265625 L 468.351562 132.738281 L 507.605469 132.738281 L 573.558594 202.878906 L 573.558594 132.738281 Z M 611.617188 132.738281"/><path fill="#2A4266" d="M 624.066406 61.675781 L 456.574219 61.675781 L 448.199219 69.957031 L 390.9375 126.578125 L 382.429688 134.992188 L 382.429688 255.53125 L 390.9375 263.945312 L 447.5625 319.929688 L 455.933594 328.207031 L 623.425781 328.207031 L 631.800781 319.925781 L 689.0625 263.304688 L 697.570312 254.890625 L 697.570312 134.351562 L 689.0625 125.9375 L 632.4375 69.957031 Z M 612.289062 90.335938 L 668.910156 146.316406 L 668.910156 242.925781 L 611.648438 299.546875 L 467.710938 299.546875 L 411.089844 243.566406 L 411.089844 146.957031 L 468.351562 90.335938 Z M 612.289062 90.335938"/>`;
const LOGO_COMPLETA = `<path fill="#0D0D0D" d="M 218.320312 372.214844 L 218.320312 493.960938 L 188.09375 519.957031 L 106.71875 436.257812 L 106.71875 507.488281 L 66.347656 507.488281 L 66.347656 372.214844 L 107.988281 372.214844 L 177.949219 446.617188 L 177.949219 372.214844 Z M 218.320312 372.214844"/><path fill="#0D0D0D" d="M 363.519531 411.105469 L 316.175781 411.105469 L 304.128906 422.945312 L 304.128906 456.550781 L 316.386719 468.597656 L 363.941406 468.597656 L 375.777344 456.972656 L 375.777344 423.152344 Z M 420.796875 471.558594 L 382.964844 508.96875 L 296.515625 508.96875 L 259.105469 471.980469 L 259.105469 408.148438 L 296.941406 370.738281 L 383.386719 370.738281 L 420.796875 407.722656 Z M 420.796875 471.558594"/><path fill="#0D0D0D" d="M 504.492188 438.160156 L 554.164062 438.160156 L 564.519531 428.015625 L 564.519531 416.816406 L 558.179688 410.894531 L 504.492188 410.894531 Z M 461.585938 507.488281 L 461.585938 372.214844 L 579.316406 372.214844 L 608.695312 401.597656 L 608.695312 437.949219 L 590.941406 455.070312 L 608.484375 472.613281 L 608.484375 507.488281 L 565.363281 507.488281 L 565.363281 487.410156 L 554.164062 476.207031 L 504.492188 476.207031 L 504.492188 507.488281 Z M 461.585938 507.488281"/><path fill="#0D0D0D" d="M 790.035156 372.214844 L 790.035156 507.699219 L 767.84375 507.699219 L 750.722656 490.789062 L 730.644531 508.96875 L 686.257812 508.96875 L 651.59375 474.304688 L 651.59375 372.214844 L 694.921875 372.214844 L 694.921875 458.03125 L 705.492188 468.597656 L 731.066406 468.597656 L 746.707031 454.648438 L 746.707031 372.214844 Z M 790.035156 372.214844"/><path fill="#0D0D0D" d="M 971.167969 507.488281 L 971.167969 435.203125 L 924.035156 485.929688 L 876.898438 435.414062 L 876.898438 507.488281 L 835.261719 507.488281 L 835.261719 387.644531 L 862.105469 362.707031 L 924.246094 426.324219 L 986.808594 362.707031 L 1013.648438 388.070312 L 1013.648438 507.488281 Z M 971.167969 507.488281"/><path fill="#2A4266" d="M 611.617188 132.738281 L 611.617188 243.96875 L 583.125 272.019531 L 506.410156 193.113281 L 506.410156 260.265625 L 468.351562 260.265625 L 468.351562 132.738281 L 507.605469 132.738281 L 573.558594 202.878906 L 573.558594 132.738281 Z M 611.617188 132.738281"/><path fill="#2A4266" d="M 624.066406 61.675781 L 456.574219 61.675781 L 448.199219 69.957031 L 390.9375 126.578125 L 382.429688 134.992188 L 382.429688 255.53125 L 390.9375 263.945312 L 447.5625 319.929688 L 455.933594 328.207031 L 623.425781 328.207031 L 631.800781 319.925781 L 689.0625 263.304688 L 697.570312 254.890625 L 697.570312 134.351562 L 689.0625 125.9375 L 632.4375 69.957031 Z M 612.289062 90.335938 L 668.910156 146.316406 L 668.910156 242.925781 L 611.648438 299.546875 L 467.710938 299.546875 L 411.089844 243.566406 L 411.089844 146.957031 L 468.351562 90.335938 Z M 612.289062 90.335938"/><path fill="#2A4266" d="M 169.132812 555.050781 L 169.132812 559.667969 L 152.347656 559.667969 L 152.347656 566.070312 L 167.644531 566.070312 L 167.644531 570.816406 L 152.347656 570.816406 L 152.347656 577.554688 L 169.296875 577.554688 L 169.296875 582.171875 L 147.714844 582.171875 L 147.714844 555.050781 Z M 169.132812 555.050781"/><path fill="#2A4266" d="M 207.460938 555.050781 L 207.460938 580.859375 L 203.835938 584.121094 L 184.351562 562.210938 L 184.351562 582.171875 L 179.84375 582.171875 L 179.84375 555.050781 L 184.792969 555.050781 L 202.949219 575.648438 L 202.949219 555.050781 Z M 207.460938 555.050781"/><path fill="#2A4266" d="M 243.609375 562.46875 L 240.632812 559.375 L 226.863281 559.375 L 223.320312 563.144531 L 223.320312 573.992188 L 226.984375 577.851562 L 240.027344 577.851562 L 241.921875 575.898438 L 241.921875 571.410156 L 233.546875 571.449219 L 233.546875 567.382812 L 246.550781 567.382812 L 246.550781 582.171875 L 244.214844 582.171875 L 242.445312 579.585938 L 239.90625 582.34375 L 224.730469 582.34375 L 218.449219 575.6875 L 218.449219 561.449219 L 224.691406 554.878906 L 243.007812 554.878906 L 246.871094 558.949219 Z M 243.609375 562.46875"/><path fill="#2A4266" d="M 279.519531 555.050781 L 279.519531 559.667969 L 262.734375 559.667969 L 262.734375 566.070312 L 278.03125 566.070312 L 278.03125 570.816406 L 262.734375 570.816406 L 262.734375 577.554688 L 279.679688 577.554688 L 279.679688 582.171875 L 258.101562 582.171875 L 258.101562 555.050781 Z M 279.519531 555.050781"/><path fill="#2A4266" d="M 317.847656 555.050781 L 317.847656 580.859375 L 314.222656 584.121094 L 294.738281 562.210938 L 294.738281 582.171875 L 290.230469 582.171875 L 290.230469 555.050781 L 295.179688 555.050781 L 313.335938 575.648438 L 313.335938 555.050781 Z M 317.847656 555.050781"/><path fill="#2A4266" d="M 350.976562 582.171875 L 350.976562 570.855469 L 334.191406 570.855469 L 334.191406 582.171875 L 329.519531 582.171875 L 329.519531 555.050781 L 334.191406 555.050781 L 334.191406 566.195312 L 350.976562 566.195312 L 350.976562 555.050781 L 355.648438 555.050781 L 355.648438 582.171875 Z M 350.976562 582.171875"/><path fill="#2A4266" d="M 382.621094 559.457031 L 376.378906 559.457031 L 371.347656 564.667969 L 371.347656 570.222656 L 387.652344 570.222656 L 387.652344 564.710938 Z M 387.652344 582.171875 L 387.652344 574.503906 L 371.347656 574.503906 L 371.347656 582.171875 L 366.71875 582.171875 L 366.71875 562.972656 L 374.285156 554.835938 L 384.753906 554.835938 L 392.320312 562.933594 L 392.320312 582.171875 Z M 387.652344 582.171875"/><path fill="#2A4266" d="M 408.101562 569.246094 L 420.945312 569.246094 L 424.085938 565.984375 L 424.085938 562 L 421.789062 559.625 L 408.101562 559.625 Z M 403.390625 582.171875 L 403.390625 555.050781 L 423.882812 555.050781 L 428.957031 560.433594 L 428.957031 567.296875 L 425.132812 571.28125 L 428.835938 575.136719 L 428.835938 582.171875 L 424.046875 582.171875 L 424.046875 576.875 L 421.023438 573.699219 L 408.101562 573.699219 L 408.101562 582.171875 Z M 403.390625 582.171875"/><path fill="#2A4266" d="M 444.898438 582.171875 L 440.226562 582.171875 L 440.226562 555.050781 L 444.898438 555.050781 Z M 444.898438 582.171875"/><path fill="#2A4266" d="M 471.871094 559.457031 L 465.628906 559.457031 L 460.597656 564.667969 L 460.597656 570.222656 L 476.902344 570.222656 L 476.902344 564.710938 Z M 476.902344 582.171875 L 476.902344 574.503906 L 460.597656 574.503906 L 460.597656 582.171875 L 455.96875 582.171875 L 455.96875 562.972656 L 463.539062 554.835938 L 474.003906 554.835938 L 481.574219 562.933594 L 481.574219 582.171875 Z M 476.902344 582.171875"/><path fill="#2A4266" d="M 531.171875 555.050781 L 534.671875 558.78125 L 531.414062 562.210938 L 528.796875 559.5 L 515.105469 559.5 L 515.105469 566.195312 L 529.761719 566.195312 L 529.761719 570.941406 L 515.105469 570.941406 L 515.105469 577.722656 L 529.035156 577.722656 L 531.613281 575.054688 L 534.832031 578.441406 L 531.292969 582.171875 L 510.515625 582.171875 L 510.515625 555.050781 Z M 531.171875 555.050781"/><path fill="#2A4266" d="M 589.867188 582.171875 L 589.867188 562.339844 L 578.3125 576.113281 L 566.71875 562.382812 L 566.71875 582.171875 L 562.167969 582.171875 L 562.167969 556.875 L 565.308594 553.78125 L 578.351562 569.035156 L 591.355469 553.78125 L 594.535156 556.914062 L 594.535156 582.171875 Z M 589.867188 582.171875"/><path fill="#2A4266" d="M 621.507812 559.457031 L 615.269531 559.457031 L 610.238281 564.667969 L 610.238281 570.222656 L 626.539062 570.222656 L 626.539062 564.710938 Z M 626.539062 582.171875 L 626.539062 574.503906 L 610.238281 574.503906 L 610.238281 582.171875 L 605.605469 582.171875 L 605.605469 562.972656 L 613.175781 554.835938 L 623.640625 554.835938 L 631.210938 562.933594 L 631.210938 582.171875 Z M 626.539062 582.171875"/><path fill="#2A4266" d="M 669.898438 555.050781 L 669.898438 580.859375 L 666.273438 584.121094 L 646.789062 562.210938 L 646.789062 582.171875 L 642.28125 582.171875 L 642.28125 555.050781 L 647.230469 555.050781 L 665.390625 575.648438 L 665.390625 555.050781 Z M 669.898438 555.050781"/><path fill="#2A4266" d="M 707.175781 555.050781 L 707.175781 582.214844 L 704.558594 582.214844 L 702.707031 578.441406 L 698.722656 582.386719 L 687.773438 582.386719 L 681.574219 575.859375 L 681.574219 555.050781 L 686.242188 555.050781 L 686.242188 573.949219 L 689.824219 577.808594 L 698.359375 577.808594 L 702.507812 573.699219 L 702.507812 555.050781 Z M 707.175781 555.050781"/><path fill="#2A4266" d="M 727.546875 582.171875 L 727.546875 559.625 L 720.945312 559.625 L 718.085938 562.636719 L 714.703125 559.074219 L 718.527344 555.050781 L 741.273438 555.050781 L 745.097656 559.074219 L 741.675781 562.636719 L 738.820312 559.625 L 732.214844 559.625 L 732.214844 582.171875 Z M 727.546875 582.171875"/><path fill="#2A4266" d="M 774.042969 555.050781 L 774.042969 559.667969 L 757.257812 559.667969 L 757.257812 566.070312 L 772.554688 566.070312 L 772.554688 570.816406 L 757.257812 570.816406 L 757.257812 577.554688 L 774.203125 577.554688 L 774.203125 582.171875 L 752.628906 582.171875 L 752.628906 555.050781 Z M 774.042969 555.050781"/><path fill="#2A4266" d="M 812.371094 555.050781 L 812.371094 580.859375 L 808.746094 584.121094 L 789.261719 562.210938 L 789.261719 582.171875 L 784.753906 582.171875 L 784.753906 555.050781 L 789.703125 555.050781 L 807.859375 575.648438 L 807.859375 555.050781 Z M 812.371094 555.050781"/><path fill="#2A4266" d="M 837.691406 592.300781 L 835.074219 589.503906 L 837.652344 586.878906 L 836.039062 585.179688 L 836.039062 582.34375 L 829.761719 582.34375 L 823.359375 575.5625 L 823.359375 561.660156 L 829.761719 554.878906 L 846.75 554.878906 L 851.015625 559.375 L 847.636719 562.933594 L 844.335938 559.457031 L 831.894531 559.457031 L 828.191406 563.355469 L 828.191406 573.824219 L 831.933594 577.765625 L 844.414062 577.765625 L 847.675781 574.332031 L 850.976562 577.851562 L 846.75 582.34375 L 839.984375 582.34375 L 839.984375 583.488281 L 843.046875 586.664062 Z M 837.691406 592.300781"/><path fill="#2A4266" d="M 881.371094 547.25 L 876.015625 553.609375 L 871.628906 549.457031 L 868.488281 553.015625 L 865.671875 550.472656 L 871.023438 544.074219 L 875.414062 548.3125 L 878.554688 544.707031 Z M 876.417969 559.457031 L 870.179688 559.457031 L 865.148438 564.671875 L 865.148438 570.222656 L 881.453125 570.222656 L 881.453125 564.710938 Z M 881.453125 582.171875 L 881.453125 574.503906 L 865.148438 574.503906 L 865.148438 582.171875 L 860.515625 582.171875 L 860.515625 562.976562 L 868.085938 554.839844 L 878.554688 554.839844 L 886.121094 562.933594 L 886.121094 582.171875 Z M 881.453125 582.171875"/><path fill="#2A4266" d="M 918.003906 559.414062 L 905.042969 559.414062 L 901.339844 563.355469 L 901.339844 573.824219 L 905.082031 577.765625 L 918.085938 577.765625 L 921.789062 573.910156 L 921.789062 563.398438 Z M 926.660156 575.5625 L 920.179688 582.382812 L 902.988281 582.382812 L 896.507812 575.5625 L 896.507812 561.660156 L 902.988281 554.835938 L 920.179688 554.835938 L 926.660156 561.660156 Z M 926.660156 575.5625"/><path fill="#2A4266" d="M 244.796875 628.449219 L 260.015625 628.449219 L 263.558594 624.675781 L 263.558594 614.292969 L 259.976562 610.480469 L 244.796875 610.480469 Z M 240.128906 605.902344 L 262.269531 605.902344 L 268.589844 612.554688 L 268.589844 626.371094 L 262.269531 633.023438 L 240.128906 633.023438 Z M 240.128906 605.902344"/><path fill="#2A4266" d="M 300.234375 605.902344 L 303.734375 609.632812 L 300.472656 613.0625 L 297.859375 610.351562 L 284.167969 610.351562 L 284.167969 617.046875 L 298.824219 617.046875 L 298.824219 621.792969 L 284.167969 621.792969 L 284.167969 628.574219 L 298.097656 628.574219 L 300.675781 625.90625 L 303.894531 629.292969 L 300.355469 633.023438 L 279.578125 633.023438 L 279.578125 605.902344 Z M 300.234375 605.902344"/><path fill="#2A4266" d="M 332.117188 625.863281 L 334.851562 628.660156 L 345.964844 628.660156 L 346.769531 627.515625 L 329.054688 612.34375 L 333.808594 605.730469 L 348.984375 605.730469 L 352.566406 609.589844 L 349.304688 613.019531 L 346.691406 610.265625 L 336.464844 610.265625 L 335.578125 611.453125 L 353.414062 626.5 L 348.5 633.195312 L 332.601562 633.195312 L 328.855469 629.253906 Z M 332.117188 625.863281"/><path fill="#2A4266" d="M 367.058594 633.023438 L 362.390625 633.023438 L 362.390625 605.902344 L 367.058594 605.902344 Z M 367.058594 633.023438"/><path fill="#2A4266" d="M 377.566406 628.363281 L 391.941406 628.363281 L 392.742188 627.390625 L 376.078125 612.257812 L 380.667969 605.902344 L 397.65625 605.902344 L 397.65625 610.5625 L 383.808594 610.5625 L 383.042969 611.539062 L 399.75 626.625 L 395.039062 633.023438 L 377.566406 633.023438 Z M 377.566406 628.363281"/><path fill="#2A4266" d="M 416.9375 633.023438 L 416.9375 610.476562 L 410.335938 610.476562 L 407.476562 613.488281 L 404.097656 609.925781 L 407.921875 605.902344 L 430.667969 605.902344 L 434.492188 609.925781 L 431.070312 613.488281 L 428.210938 610.476562 L 421.609375 610.476562 L 421.609375 633.023438 Z M 416.9375 633.023438"/><path fill="#2A4266" d="M 463.4375 605.902344 L 463.4375 610.523438 L 446.648438 610.523438 L 446.648438 616.921875 L 461.945312 616.921875 L 461.945312 621.667969 L 446.648438 621.667969 L 446.648438 628.40625 L 463.597656 628.40625 L 463.597656 633.023438 L 442.019531 633.023438 L 442.019531 605.902344 Z M 463.4375 605.902344"/><path fill="#2A4266" d="M 501.84375 633.023438 L 501.84375 613.191406 L 490.289062 626.964844 L 478.695312 613.234375 L 478.695312 633.023438 L 474.144531 633.023438 L 474.144531 607.726562 L 477.285156 604.632812 L 490.328125 619.886719 L 503.332031 604.632812 L 506.511719 607.765625 L 506.511719 633.023438 Z M 501.84375 633.023438"/><path fill="#2A4266" d="M 533.484375 610.308594 L 527.246094 610.308594 L 522.210938 615.519531 L 522.210938 621.074219 L 538.519531 621.074219 L 538.519531 615.5625 Z M 538.519531 633.023438 L 538.519531 625.355469 L 522.210938 625.355469 L 522.210938 633.023438 L 517.582031 633.023438 L 517.582031 613.828125 L 525.152344 605.6875 L 535.617188 605.6875 L 543.1875 613.785156 L 543.1875 633.023438 Z M 538.519531 633.023438"/><path fill="#2A4266" d="M 555.144531 625.863281 L 557.878906 628.660156 L 568.992188 628.660156 L 569.796875 627.515625 L 552.082031 612.34375 L 556.835938 605.730469 L 572.011719 605.730469 L 575.59375 609.589844 L 572.335938 613.019531 L 569.71875 610.265625 L 559.492188 610.265625 L 558.605469 611.453125 L 576.441406 626.5 L 571.527344 633.195312 L 555.628906 633.195312 L 551.882812 629.253906 Z M 555.144531 625.863281"/><path fill="#2A4266" d="M 607.960938 620.058594 L 620.078125 620.058594 L 622.535156 617.46875 L 622.535156 613.105469 L 620.039062 610.480469 L 607.960938 610.480469 Z M 603.292969 633.023438 L 603.292969 605.902344 L 622.171875 605.902344 L 627.367188 611.324219 L 627.367188 619.039062 L 622.171875 624.507812 L 607.960938 624.507812 L 607.960938 633.023438 Z M 603.292969 633.023438"/><path fill="#2A4266" d="M 641.617188 620.097656 L 654.460938 620.097656 L 657.597656 616.835938 L 657.597656 612.851562 L 655.304688 610.480469 L 641.617188 610.480469 Z M 636.90625 633.023438 L 636.90625 605.902344 L 657.398438 605.902344 L 662.472656 611.285156 L 662.472656 618.148438 L 658.648438 622.132812 L 662.351562 625.988281 L 662.351562 633.023438 L 657.558594 633.023438 L 657.558594 627.726562 L 654.539062 624.550781 L 641.617188 624.550781 L 641.617188 633.023438 Z M 636.90625 633.023438"/><path fill="#2A4266" d="M 695.160156 605.902344 L 695.160156 610.523438 L 678.371094 610.523438 L 678.371094 616.921875 L 693.671875 616.921875 L 693.671875 621.667969 L 678.371094 621.667969 L 678.371094 628.40625 L 695.320312 628.40625 L 695.320312 633.023438 L 673.742188 633.023438 L 673.742188 605.902344 Z M 695.160156 605.902344"/><path fill="#2A4266" d="M 710.539062 628.449219 L 725.757812 628.449219 L 729.296875 624.675781 L 729.296875 614.292969 L 725.714844 610.480469 L 710.539062 610.480469 Z M 705.867188 605.902344 L 728.011719 605.902344 L 734.332031 612.554688 L 734.332031 626.371094 L 728.011719 633.023438 L 705.867188 633.023438 Z M 705.867188 605.902344"/><path fill="#2A4266" d="M 749.992188 633.023438 L 745.320312 633.023438 L 745.320312 605.902344 L 749.992188 605.902344 Z M 749.992188 633.023438"/><path fill="#2A4266" d="M 776.964844 610.308594 L 770.722656 610.308594 L 765.691406 615.519531 L 765.691406 621.074219 L 781.996094 621.074219 L 781.996094 615.5625 Z M 781.996094 633.023438 L 781.996094 625.355469 L 765.691406 625.355469 L 765.691406 633.023438 L 761.0625 633.023438 L 761.0625 613.828125 L 768.628906 605.6875 L 779.097656 605.6875 L 786.667969 613.785156 L 786.667969 633.023438 Z M 781.996094 633.023438"/><path fill="#2A4266" d="M 802.40625 633.023438 L 797.734375 633.023438 L 797.734375 605.902344 L 802.40625 605.902344 Z M 802.40625 633.023438"/><path fill="#2A4266" d="M 814.964844 625.863281 L 817.703125 628.660156 L 828.816406 628.660156 L 829.621094 627.515625 L 811.90625 612.34375 L 816.65625 605.730469 L 831.835938 605.730469 L 835.417969 609.589844 L 832.15625 613.019531 L 829.539062 610.265625 L 819.3125 610.265625 L 818.429688 611.453125 L 836.261719 626.5 L 831.351562 633.195312 L 815.449219 633.195312 L 811.707031 629.253906 Z M 814.964844 625.863281"/>`;

// Símbolo aplicado sobre círculo branco, conforme o manual de identidade
function LogoN({ size = 40, circulo = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="NORUM">
      {circulo && <circle cx="50" cy="50" r="50" fill="#FFFFFF" />}
      <g transform="translate(50 50) scale(0.255) translate(-540 -195)"
         dangerouslySetInnerHTML={{ __html: LOGO_SIMBOLO }} />
    </svg>
  );
}

const NAV = [
  { k: "painel", label: "Painel de controle", icon: "▚" },
  { k: "extintor", label: "Extintores", icon: "▲" },
  { k: "caixa_dagua", label: "Reservatórios de água", icon: "◆" },
  { k: "caixa_gordura", label: "Caixas de gordura", icon: "▬" },
  { k: "orcamentos", label: "Orçamentos", icon: "▧" },
  { k: "agenda", label: "Agenda de serviços", icon: "▦" },
  { k: "mensal", label: "Relatório mensal", icon: "▣" },
  { k: "financeiro", label: "Notas fiscais e pagamentos", icon: "▤" },
  { k: "condominios", label: "Condomínios", icon: "◱" },
];

export default function App() {
  const [db, setDb] = useState(null);
  const [aba, setAba] = useState("painel");
  const [condFiltro, setCondFiltro] = useState("todos");
  const [modal, setModal] = useState(null);
  const [condAberto, setCondAberto] = useState(null);
  const [menuAberto, setMenuAberto] = useState(false); // menu lateral no celular
  const [usuario, setUsuario] = useState(null);      // nome do usuário logado
  const [saudacao, setSaudacao] = useState(false);   // exibe a saudação de boas-vindas
  const [erroBanco, setErroBanco] = useState("");

  // Recarrega tudo do banco
  const recarregar = useCallback(async () => {
    try { setDb(await carregarTudo()); setErroBanco(""); }
    catch (e) { setErroBanco(e.message || "Falha ao carregar dados."); }
  }, []);

  // Mantém a sessão do Supabase entre recarregamentos da página
  useEffect(() => {
    if (!supabaseConfigurado) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const email = data.session.user.email || "usuário";
        setUsuario(email.split("@")[0].replace(/^\w/, (c) => c.toUpperCase()));
        recarregar();
      }
    });
  }, [recarregar]);

  const aoEntrar = async (nome) => { setUsuario(nome); setSaudacao(true); await recarregar(); };
  const sair = async () => { if (supabaseConfigurado) await supabase.auth.signOut(); setUsuario(null); setDb(null); setAba("painel"); };

  // Fluxo de entrada: login real -> animação -> saudação -> painel
  if (!usuario) return <TelaLogin onEntrar={aoEntrar} />;
  if (!db) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 28,
      fontFamily: "'Inter', system-ui, sans-serif", background: BG_BASE, textAlign: "center" }}>
      <div>
        <div style={{ display: "inline-block", marginBottom: 18 }}><LogoN size={54} /></div>
        {erroBanco ? (
          <>
            <div style={{ color: TITULO, fontSize: 17, fontWeight: 700 }}>Não foi possível carregar os dados</div>
            <div style={{ color: MUTED, fontSize: 13.5, margin: "8px 0 18px", maxWidth: 320 }}>{erroBanco}</div>
            <button className="app-btn btn-primary" style={{ background: "linear-gradient(135deg,#28B6E8,#7FE1FF)", color: "#04121f", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 800, cursor: "pointer" }}
              onClick={() => { setErroBanco(""); recarregar(); }}>Tentar novamente</button>
          </>
        ) : (
          <div style={{ color: TITULO, fontSize: 15 }}>Carregando dados…</div>
        )}
      </div>
    </div>
  );

  const condById = (id) => id === AVULSO ? { id: AVULSO, nome: "Avulso / sem condomínio" } : db.condominios.find((c) => c.id === id);
  const opcoesCliente = [...db.condominios, { id: AVULSO, nome: "Avulso / sem condomínio" }];
  const nomeCliente = (reg) => reg.condId === AVULSO ? (reg.clienteAvulso ? `${reg.clienteAvulso} (avulso)` : "Avulso / sem condomínio") : (condById(reg.condId)?.nome || "—");
  const filtra = (arr) => condFiltro === "todos" ? arr : arr.filter((x) => x.condId === condFiltro);
  const itens = filtra(db.itens), servicos = filtra(db.servicos);

  const alertas = db.itens.map((i) => ({ ...i, dias: diasAte(i.validade) })).filter((i) => i.dias <= 30).sort((a, b) => a.dias - b.dias);
  const aReceber = db.servicos.filter((s) => s.status === "emitida_nao_paga").reduce((t, s) => t + valorEfetivo(s), 0);
  const naoEmitido = db.servicos.filter((s) => s.status === "nao_emitida").reduce((t, s) => t + valorEfetivo(s), 0);
  const recebido = db.servicos.filter((s) => s.status === "paga").reduce((t, s) => t + valorEfetivo(s), 0);
  const pgtoPendente = aReceber + naoEmitido; // tudo que ainda não foi pago
  const executadosNaoPagos = db.servicos.filter((s) => s.executadoEm && s.status !== "paga").length;

  const erroAlerta = (e) => alert("Não foi possível salvar: " + (e.message || e));

  const salvarCond = async (d) => {
    const { error } = d.id
      ? await supabase.from("condominios").update(condParaLinha(d)).eq("id", d.id)
      : await supabase.from("condominios").insert(condParaLinha(d));
    if (error) return erroAlerta(error);
    setModal(null); await recarregar();
  };
  const salvarItem = async (d) => {
    const validade = d.validade || addMeses(d.ultima, TIPOS_ITEM[d.tipo].validadeMeses);
    const linha = itemParaLinha({ ...d, validade });
    const { error } = d.id
      ? await supabase.from("itens_monitorados").update(linha).eq("id", d.id)
      : await supabase.from("itens_monitorados").insert(linha);
    if (error) return erroAlerta(error);
    setModal(null); await recarregar();
  };
  // Abre o modal para escolher a data da manutenção
  const registrarManut = (item) => setModal({ tipo: "manut", data: item });
  // Confirma a manutenção na data escolhida (validade recalculada a partir dela)
  const confirmarManut = async (item, dataManut) => {
    const validade = addMeses(dataManut, TIPOS_ITEM[item.tipo].validadeMeses);
    const { error } = await supabase.from("itens_monitorados").update({ ultima_manutencao: dataManut, validade }).eq("id", item.id);
    if (error) return erroAlerta(error);
    setModal(null); await recarregar();
  };
  // Marca um serviço como executado (data + valor real cobrado)
  const concluirServico = async (s, dataExec, valorReal) => {
    const n = { ...s, executadoEm: dataExec, valor: valorReal };
    const { error } = await supabase.from("servicos").update(servParaLinha(n)).eq("id", s.id);
    if (error) return erroAlerta(error);
    setModal(null); await recarregar();
  };
  const salvarServico = async (d) => {
    const linha = servParaLinha(d);
    const { error } = d.id
      ? await supabase.from("servicos").update(linha).eq("id", d.id)
      : await supabase.from("servicos").insert(linha);
    if (error) return erroAlerta(error);
    setModal(null); await recarregar();
  };
  const avancarStatus = async (s) => {
    let n = { ...s };
    if (s.status === "nao_emitida") { n.status = "emitida_nao_paga"; n.nfNumero = s.nfNumero || prompt("Informe o número da nota fiscal emitida:") || ""; }
    else if (s.status === "emitida_nao_paga") { n.status = "paga"; n.pgtoData = hoje(); }
    else { n.status = "nao_emitida"; n.pgtoData = ""; n.nfNumero = ""; }
    const { error } = await supabase.from("servicos").update(servParaLinha(n)).eq("id", s.id);
    if (error) return erroAlerta(error);
    await recarregar();
  };
  // ----- Orçamentos -----
  const itensDoOrc = (orcId) => (db.orcItens || []).filter((i) => i.orcId === orcId);

  const salvarOrcamento = async (o, linhas) => {
    let orcId = o.id;
    if (orcId) {
      const { error } = await supabase.from("orcamentos").update(orcParaLinha(o)).eq("id", orcId);
      if (error) return erroAlerta(error);
    } else {
      const { data, error } = await supabase.from("orcamentos").insert(orcParaLinha(o)).select("id").single();
      if (error) return erroAlerta(error);
      orcId = data.id;
    }
    // Regrava as linhas de itens (apaga as antigas e insere as atuais)
    await supabase.from("orcamento_itens").delete().eq("orcamento_id", orcId);
    const validas = (linhas || []).filter((l) => l.descricao && l.descricao.trim());
    if (validas.length) {
      const { error } = await supabase.from("orcamento_itens").insert(
        validas.map((l, idx) => ({ orcamento_id: orcId, descricao: l.descricao, quantidade: l.quantidade || 1, valor_unitario: l.valorUnitario || 0, ordem: idx }))
      );
      if (error) return erroAlerta(error);
    }
    setModal(null); await recarregar();
  };

  // Aprovar: marca como aprovado e cria o serviço correspondente na agenda
  const aprovarOrcamento = async (o) => {
    const total = totalOrc(itensDoOrc(o.id));
    if (!confirm(`Aprovar o orçamento ORC-${String(o.numero).padStart(4, "0")} e criar o serviço na agenda por ${brl(total)}?`)) return;
    const { data, error } = await supabase.from("servicos").insert({
      condominio_id: nuloSeAvulso(o.condId),
      cliente_avulso: o.condId === AVULSO ? (o.clienteAvulso || "Avulso") : null,
      titulo: o.titulo,
      data_agendada: hoje(),
      valor_estimado: total,
      valor: 0,
      status_nota: "nao_emitida",
    }).select("id").single();
    if (error) return erroAlerta(error);
    const { error: e2 } = await supabase.from("orcamentos").update({ status: "aprovado", servico_id: data.id }).eq("id", o.id);
    if (e2) return erroAlerta(e2);
    await recarregar();
    alert("Orçamento aprovado. O serviço foi criado na agenda com a data de hoje — ajuste a data se necessário.");
  };

  const mudarStatusOrc = async (o, novo) => {
    const { error } = await supabase.from("orcamentos").update({ status: novo }).eq("id", o.id);
    if (error) return erroAlerta(error);
    await recarregar();
  };

  const excluirOrcamento = async (o) => {
    if (!confirm("Excluir este orçamento? Os itens também serão removidos.")) return;
    const { error } = await supabase.from("orcamentos").delete().eq("id", o.id);
    if (error) return erroAlerta(error);
    await recarregar();
  };

  const excluir = async (col, id) => {
    if (!confirm("Excluir este registro?")) return;
    const tabela = col === "condominios" ? "condominios" : col === "itens" ? "itens_monitorados" : "servicos";
    const { error } = await supabase.from(tabela).delete().eq("id", id);
    if (error) return erroAlerta(error);
    await recarregar();
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: INK, minHeight: "100vh", display: "flex",
      background: `radial-gradient(1200px 600px at 12% -10%, #0f3763 0%, transparent 55%), radial-gradient(1000px 500px at 110% 10%, #0b2c4d 0%, transparent 50%), ${BG_BASE}` }}>
      {saudacao && <Saudacao usuario={usuario} onFim={() => setSaudacao(false)} />}      <style>{`
        * { box-sizing: border-box; }
        @keyframes floatIn { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform:none; } }
        @keyframes sheen { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
        @keyframes pulseDot { 0%,100% { opacity:1; } 50% { opacity:.35; } }
        .app-btn { position:relative; border:none; border-radius:12px; padding:10px 16px; font-weight:700; font-size:13px; cursor:pointer; overflow:hidden;
          transition: transform .15s ease, box-shadow .25s ease, filter .2s ease; }
        .app-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(18,50,91,.20); filter: brightness(1.05); }
        .app-btn:active { transform: translateY(0) scale(.98); }
        .app-btn::after { content:""; position:absolute; top:0; left:0; width:40%; height:100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); transform: translateX(-120%); }
        .app-btn:hover::after { animation: sheen .7s ease; }
        .btn-primary { background: linear-gradient(135deg, ${CIANO}, #7FE1FF); color:#04121f; }
        .btn-ghost { background: rgba(127,175,232,.10); color:#bcd4f2; }
        .glass { background:${GLASS}; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          border:1px solid rgba(127,175,232,.14); border-radius:18px; box-shadow: 0 12px 34px rgba(0,0,0,.35); }
        .nav-item { display:flex; align-items:center; gap:12px; width:100%; border:none; background:transparent; color:#9fb6d6;
          padding:13px 16px; border-radius:12px; cursor:pointer; font-size:14px; font-weight:600; text-align:left;
          transition: background .2s ease, color .2s ease, transform .15s ease; position:relative; }
        .nav-item:hover { background: rgba(127,175,232,.10); color:#fff; transform: translateX(3px); }
        .nav-item.active { background: linear-gradient(135deg, rgba(40,182,232,.30), rgba(127,175,232,.05)); color:#fff; }
        .nav-item.active::before { content:""; position:absolute; left:0; top:18%; height:64%; width:4px; border-radius:4px; background:${CIANO}; box-shadow:0 0 12px ${CIANO}; }
        .nav-ico { width:26px; text-align:center; font-size:16px; opacity:.9; }
        table { width:100%; border-collapse:collapse; }
        th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:${MUTED}; padding:11px 14px; border-bottom:1px solid ${LINE}; }
        td { padding:12px 14px; border-bottom:1px solid ${LINE}; font-size:14px; color:${INK}; }
        tr:last-child td { border-bottom:none; }
        input,select { width:100%; padding:10px 12px; border:1px solid rgba(127,175,232,.20); border-radius:10px; font-size:14px; background:rgba(6,22,38,.6); color:${INK}; }
        input::placeholder { color:#5f7ba0; }
        input:focus,select:focus { outline:none; border-color:${CIANO}; box-shadow:0 0 0 3px rgba(40,182,232,.20); }
        select option { background:${CARD_SOLID}; color:${INK}; }
        label { font-size:12px; font-weight:700; color:#9fb6d6; display:block; margin:14px 0 5px; }
        .fade { animation: floatIn .35s ease both; }
        .cond-card { cursor:pointer; padding:18px; text-align:left; border:1px solid rgba(127,175,232,.14);
          transition: transform .18s ease, box-shadow .25s ease; }
        .cond-card:hover { transform: translateY(-4px); box-shadow: 0 18px 38px rgba(0,0,0,.45); }
        .cond-card:active { transform: translateY(-1px) scale(.995); }

        /* ----- Botão de menu e overlay (só aparecem no celular) ----- */
        .btn-menu { display:none; background:rgba(127,175,232,.12); color:#dce9fb; border:none;
          border-radius:10px; width:42px; height:42px; font-size:19px; cursor:pointer; flex-shrink:0; }
        .overlay-menu { display:none; position:fixed; inset:0; background:rgba(3,12,22,.6);
          backdrop-filter:blur(2px); z-index:40; }

        /* ----- Adaptação para telas pequenas (celular) ----- */
        @media (max-width: 860px) {
          .barra-lateral { position:fixed !important; left:0; top:0; z-index:45;
            transform:translateX(-100%); transition:transform .25s ease; box-shadow:0 0 40px rgba(0,0,0,.5); }
          .barra-lateral.aberta { transform:translateX(0); }
          .overlay-menu { display:block; }
          .btn-menu { display:block; }
          .topo-app { padding:14px 16px !important; gap:12px !important; flex-wrap:wrap; }
          .topo-app h1 { font-size:17px !important; }
          .subtitulo { display:none; }
          .filtro-cond { width:100% !important; margin-left:0 !important; order:3; }
          main { padding:16px !important; }
          /* tabelas rolam na horizontal em vez de espremer */
          .glass { border-radius:14px; }
          .glass table { min-width:660px; }
          .glass { overflow-x:auto !important; -webkit-overflow-scrolling:touch; }
          th, td { padding:10px 10px !important; font-size:13px !important; }
          .app-btn { padding:9px 12px; font-size:12.5px; }
        }
        @media (max-width: 560px) {
          .kpis { grid-template-columns:1fr 1fr !important; gap:10px !important; }
          .kpis .valor { font-size:22px !important; }
        }
      `}</style>

      {/* fundo escurecido ao abrir o menu no celular */}
      {menuAberto && <div className="overlay-menu" onClick={() => setMenuAberto(false)} />}

      <aside className={`barra-lateral ${menuAberto ? "aberta" : ""}`}
        style={{ width: 258, flexShrink: 0, background: `linear-gradient(180deg, ${NAVY_DK}, #071b33)`, color: "#fff",
        padding: "22px 16px", display: "flex", flexDirection: "column", gap: 6, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 6px 18px" }}>
          <LogoN size={44} />
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 1.5, fontSize: 18 }}>NORUM</div>
            <div style={{ fontSize: 10.5, opacity: 0.65, letterSpacing: 0.5 }}>ENGENHARIA · GESTÃO</div>
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.k} className={`nav-item ${aba === n.k ? "active" : ""}`} onClick={() => { setAba(n.k); setMenuAberto(false); }}>
            <span className="nav-ico">{n.icon}</span>{n.label}
            {n.k === "painel" && alertas.length > 0 && (
              <span style={{ marginLeft: "auto", background: VERMELHO, borderRadius: 999, fontSize: 11, fontWeight: 800, padding: "1px 8px", animation: "pulseDot 1.6s infinite" }}>{alertas.length}</span>
            )}
          </button>
        ))}
        <div style={{ marginTop: "auto", padding: "12px 8px", borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ fontSize: 12.5, color: "#e6eefc", fontWeight: 700 }}>{usuario}</div>
          <button onClick={sair} style={{ marginTop: 6, border: "none", background: "rgba(255,255,255,.08)", color: "#c7d6ea", fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>Encerrar sessão</button>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="topo-app" style={{ padding: "18px 28px", display: "flex", alignItems: "center", gap: 16, borderBottom: `1px solid ${LINE}` }}>
          <button className="btn-menu" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">☰</button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 21, color: TITULO }}>{NAV.find((n) => n.k === aba)?.label}</h1>
            <div className="subtitulo" style={{ fontSize: 12.5, color: MUTED }}>Gestão de condomínios · manutenção predial</div>
          </div>
          <select className="filtro-cond" value={condFiltro} onChange={(e) => setCondFiltro(e.target.value)} style={{ marginLeft: "auto", width: 250 }}>
            <option value="todos">Todos os condomínios</option>
            {db.condominios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </header>

        <main style={{ padding: 28, flex: 1 }}>
          {aba === "painel" && (
            <div className="fade">
              <div className="kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 18, marginBottom: 24 }}>
                <KPI titulo="Itens em alerta" valor={alertas.length} cor={VERMELHO} sub="vencidos ou a vencer em 30 dias" />
                <KPI titulo="Valores a receber" valor={brl(aReceber)} cor={AMARELO} sub="notas fiscais emitidas" />
                <KPI titulo="Valores a faturar" valor={brl(naoEmitido)} cor={LARANJA} sub="serviços sem nota fiscal" />
                <KPI titulo="Total recebido" valor={brl(recebido)} cor={VERDE} sub="notas fiscais liquidadas" />
              </div>
              <div className="glass" style={{ overflow: "hidden" }}>
                <div style={{ padding: "16px 18px", fontWeight: 800, color: TITULO, borderBottom: `1px solid ${LINE}` }}>Itens que requerem atenção</div>
                {alertas.length === 0 ? <div style={{ padding: 26, color: MUTED }}>Nenhuma pendência. Não há itens a vencer nos próximos 30 dias.</div> : (
                  <table><thead><tr><th>Item</th><th>Local</th><th>Condomínio</th><th>Validade</th><th>Status</th><th></th></tr></thead>
                    <tbody>{alertas.map((i) => (
                      <tr key={i.id}>
                        <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><TipoSelo tipo={i.tipo} /><span style={{ fontWeight: 600 }}>{TIPOS_ITEM[i.tipo].label}</span></span></td>
                        <td>{i.local}</td><td>{nomeCliente(i)}</td><td>{fmtData(i.validade)}</td>
                        <td><ItemStatus validade={i.validade} /></td>
                        <td><button className="app-btn btn-primary" onClick={() => registrarManut(i)}>Registrar manutenção</button></td>
                      </tr>))}</tbody></table>
                )}
              </div>
            </div>
          )}

          {TIPOS_ITEM[aba] && (
            <SecaoTipo
              tipo={aba} itens={itens.filter((i) => i.tipo === aba)}
              condById={condById}
              nomeCliente={nomeCliente}
              onAdd={() => setModal({ tipo: "item", data: { tipo: aba, ultima: hoje(), condId: db.condominios[0]?.id } })}
              onManut={registrarManut}
              onEdit={(i) => setModal({ tipo: "item", data: i })}
              onDel={(id) => excluir("itens", id)}
            />
          )}

          {aba === "orcamentos" && (
            <div className="fade">
              <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, color: TITULO }}>Orçamentos</h2>
                  <div style={{ fontSize: 12.5, color: MUTED }}>Monte a proposta, gere o PDF para o cliente e, se aprovada, converta em serviço</div>
                </div>
                <button className="app-btn btn-primary" style={{ marginLeft: "auto" }}
                  onClick={() => setModal({ tipo: "orcamento", data: { dataEmissao: hoje(), validadeDias: 15, status: "rascunho", condId: db.condominios[0]?.id }, linhas: [] })}>
                  + Novo orçamento
                </button>
              </div>
              <div className="glass" style={{ overflow: "hidden" }}>
                <table><thead><tr><th>Nº</th><th>Cliente</th><th>Objeto</th><th>Emissão</th><th>Total</th><th>Status</th><th></th></tr></thead>
                  <tbody>{(db.orcamentos || []).map((o) => {
                    const linhas = itensDoOrc(o.id);
                    return (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 800, color: TITULO }}>ORC-{String(o.numero).padStart(4, "0")}</td>
                        <td>{nomeCliente(o)}</td>
                        <td>{o.titulo}</td>
                        <td>{fmtData(o.dataEmissao)}</td>
                        <td style={{ fontWeight: 700 }}>{brl(totalOrc(linhas))}</td>
                        <td><Badge cor={STATUS_ORC[o.status].cor}>{STATUS_ORC[o.status].label}</Badge></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="app-btn btn-primary" onClick={() => gerarPdfOrcamento(o, linhas, condById(o.condId) || { nome: nomeCliente(o) })}>PDF</button>{" "}
                          {o.status !== "aprovado" && <><button className="app-btn btn-ghost" onClick={() => aprovarOrcamento(o)}>Aprovar</button>{" "}</>}
                          {o.status === "rascunho" && <><button className="app-btn btn-ghost" onClick={() => mudarStatusOrc(o, "enviado")}>Marcar enviado</button>{" "}</>}
                          <button className="app-btn btn-ghost" onClick={() => setModal({ tipo: "orcamento", data: o, linhas })}>Editar</button>{" "}
                          <button className="app-btn btn-ghost" onClick={() => excluirOrcamento(o)}>×</button>
                        </td>
                      </tr>
                    );
                  })}
                  {(db.orcamentos || []).length === 0 && <tr><td colSpan={7} style={{ color: MUTED, padding: 22 }}>Nenhum orçamento cadastrado. Utilize o botão “+ Novo orçamento”.</td></tr>}
                  </tbody></table>
              </div>
            </div>
          )}

          {aba === "agenda" && (
            <Secao titulo="Agenda de serviços" onAdd={() => setModal({ tipo: "servico", data: { data: hoje(), status: "nao_emitida", condId: db.condominios[0]?.id, valorEstimado: 0, valor: 0 } })}>
              <table><thead><tr><th>Data</th><th>Serviço</th><th>Condomínio</th><th>Estimado</th><th>Execução</th><th>Situação fiscal</th><th></th></tr></thead>
                <tbody>{[...servicos].sort((a, b) => a.data.localeCompare(b.data)).map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: diasAte(s.data) >= 0 && diasAte(s.data) <= 7 ? 800 : 400, color: diasAte(s.data) >= 0 && diasAte(s.data) <= 7 ? TITULO : INK }}>{fmtData(s.data)}</td>
                    <td>{s.titulo}</td><td>{nomeCliente(s)}</td>
                    <td>{brl(s.valorEstimado)}</td>
                    <td>{s.executadoEm
                      ? <Badge cor={VERDE}>Executado em {fmtData(s.executadoEm)}</Badge>
                      : <button className="app-btn btn-primary" onClick={() => setModal({ tipo: "concluir", data: s })}>Concluir</button>}</td>
                    <td><Badge cor={STATUS_NOTA[s.status].cor}>{STATUS_NOTA[s.status].label}</Badge></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="app-btn btn-ghost" onClick={() => setModal({ tipo: "servico", data: s })}>Editar</button>{" "}
                      <button className="app-btn btn-ghost" onClick={() => excluir("servicos", s.id)}>×</button>
                    </td>
                  </tr>))}
                  {servicos.length === 0 && <tr><td colSpan={7} style={{ color: MUTED }}>Nenhum serviço agendado no momento.</td></tr>}
                </tbody></table>
            </Secao>
          )}

          {aba === "mensal" && <RelatorioMensal servicos={servicos} nomeCliente={nomeCliente} />}

          {aba === "financeiro" && (
            <div className="fade">
              <div className="kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 18, marginBottom: 22 }}>
                <KPI titulo="Pgto pendente" valor={brl(pgtoPendente)} cor={VERMELHO} sub={`${executadosNaoPagos} serviço(s) executado(s) sem pgto`} />
                <KPI titulo="A faturar" valor={brl(naoEmitido)} cor={LARANJA} sub="emissão de nota fiscal pendente" />
                <KPI titulo="A receber" valor={brl(aReceber)} cor={AMARELO} sub="nota emitida, aguardando pgto" />
                <KPI titulo="Total recebido" valor={brl(recebido)} cor={VERDE} sub="pagamentos confirmados" />
              </div>
              <div className="glass" style={{ overflow: "hidden" }}>
                <div style={{ padding: "16px 18px", fontWeight: 800, color: TITULO, borderBottom: `1px solid ${LINE}` }}>
                  Controle de notas e pagamentos · clique no status para avançar (não emitida → emitida → pago)
                </div>
                <table><thead><tr><th>Serviço</th><th>Condomínio</th><th>Estimado</th><th>Real</th><th>NF nº</th><th>Pago em</th><th>Status</th></tr></thead>
                  <tbody>{[...db.servicos].sort((a, b) => a.status.localeCompare(b.status)).map((s) => (
                    <tr key={s.id}>
                      <td>{s.titulo}</td><td>{nomeCliente(s)}</td>
                      <td style={{ color: MUTED }}>{brl(s.valorEstimado)}</td>
                      <td style={{ fontWeight: 700 }}>{s.valor > 0 ? brl(s.valor) : "—"}</td>
                      <td>{s.nfNumero || "—"}</td><td>{fmtData(s.pgtoData)}</td>
                      <td><button onClick={() => avancarStatus(s)} style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}>
                        <Badge cor={STATUS_NOTA[s.status].cor}>{STATUS_NOTA[s.status].label} ↻</Badge></button></td>
                    </tr>))}</tbody></table>
              </div>

              <div style={{ marginTop: 22 }} className="glass">
                <div style={{ padding: "16px 18px", fontWeight: 800, color: TITULO, borderBottom: `1px solid ${LINE}` }}>
                  Conciliação · estimado × real × nota fiscal
                </div>
                <table><thead><tr><th>Serviço</th><th>Executado</th><th>Estimado</th><th>Real</th><th>Diferença</th><th>Nota fiscal</th><th>Pgto</th></tr></thead>
                  <tbody>{[...db.servicos].sort((a, b) => b.data.localeCompare(a.data)).map((s) => {
                    const temNota = s.status !== "nao_emitida";
                    const dif = s.valor > 0 ? s.valor - (s.valorEstimado || 0) : null;
                    return (
                      <tr key={s.id}>
                        <td>{s.titulo}<div style={{ fontSize: 11.5, color: MUTED }}>{nomeCliente(s)}</div></td>
                        <td>{s.executadoEm ? fmtData(s.executadoEm) : <Badge cor={MUTED}>Pendente</Badge>}</td>
                        <td style={{ color: MUTED }}>{brl(s.valorEstimado)}</td>
                        <td style={{ fontWeight: 700 }}>{s.valor > 0 ? brl(s.valor) : "—"}</td>
                        <td>{dif === null ? "—" : <span style={{ fontWeight: 700, color: dif > 0 ? VERDE : dif < 0 ? VERMELHO : MUTED }}>{dif > 0 ? "+" : ""}{brl(dif)}</span>}</td>
                        <td>{temNota ? `NF ${s.nfNumero || "—"}` : <Badge cor={LARANJA}>Faturar</Badge>}</td>
                        <td>{s.status === "paga" ? <Badge cor={VERDE}>Pago</Badge> : <Badge cor={VERMELHO}>Pendente</Badge>}</td>
                      </tr>
                    );
                  })}</tbody></table>
                <div style={{ padding: "12px 18px", fontSize: 13, color: MUTED, borderTop: `1px solid ${LINE}`, display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <span>Serviços: <strong style={{ color: TITULO }}>{db.servicos.length}</strong></span>
                  <span>Executados: <strong style={{ color: VERDE }}>{db.servicos.filter((s) => s.executadoEm).length}</strong></span>
                  <span>Pagos: <strong style={{ color: VERDE }}>{db.servicos.filter((s) => s.status === "paga").length}</strong></span>
                  <span>Pgto pendente: <strong style={{ color: VERMELHO }}>{brl(pgtoPendente)}</strong></span>
                  <span>Total estimado: <strong style={{ color: TITULO }}>{brl(db.servicos.reduce((t, s) => t + (s.valorEstimado || 0), 0))}</strong></span>
                  <span>Total real: <strong style={{ color: TITULO }}>{brl(db.servicos.reduce((t, s) => t + s.valor, 0))}</strong></span>
                </div>
              </div>
            </div>
          )}

          {aba === "condominios" && (
            <div className="fade">
              <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, color: TITULO }}>Condomínios cadastrados</h2>
                  <div style={{ fontSize: 12.5, color: MUTED }}>Selecione um condomínio para consultar síndico, telefone e administradora</div>
                </div>
                <button className="app-btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setModal({ tipo: "cond", data: {} })}>+ Cadastrar condomínio</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
                {db.condominios.map((c) => {
                  const nItens = db.itens.filter((i) => i.condId === c.id).length;
                  const nAlerta = db.itens.filter((i) => i.condId === c.id && diasAte(i.validade) <= 30).length;
                  return (
                    <button key={c.id} className="cond-card glass" onClick={() => setCondAberto(c)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center", background: `linear-gradient(135deg, ${NAVY}, ${CIANO})`, color: "#fff", fontWeight: 800, fontSize: 18 }}>{c.nome.charAt(0)}</div>
                        <div style={{ minWidth: 0, textAlign: "left" }}>
                          <div style={{ fontWeight: 800, color: TITULO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                          <div style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.administradora || "Sem administradora"}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: TITULO, background: "rgba(127,175,232,.12)", padding: "3px 10px", borderRadius: 999 }}>{nItens} {nItens === 1 ? "item" : "itens"}</span>
                        {nAlerta > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: VERMELHO, padding: "3px 10px", borderRadius: 999 }}>{nAlerta} {nAlerta === 1 ? "pendência" : "pendências"}</span>}
                      </div>
                    </button>
                  );
                })}
                {db.condominios.length === 0 && <div className="glass" style={{ padding: 26, color: MUTED, gridColumn: "1/-1" }}>Nenhum condomínio cadastrado. Utilize o botão “+ Cadastrar condomínio”.</div>}
              </div>
            </div>
          )}
        </main>
      </div>

      {condAberto && (
        <DetalheCond
          cond={condAberto}
          itens={db.itens.filter((i) => i.condId === condAberto.id)}
          onEditar={() => { setModal({ tipo: "cond", data: condAberto }); setCondAberto(null); }}
          onExcluir={() => { if (confirm("Excluir este condomínio?")) { commit({ ...db, condominios: db.condominios.filter((x) => x.id !== condAberto.id) }); setCondAberto(null); } }}
          onClose={() => setCondAberto(null)}
        />
      )}
      {modal?.tipo === "cond" && <FormCond data={modal.data} onSave={salvarCond} onClose={() => setModal(null)} />}
      {modal?.tipo === "item" && <FormItem data={modal.data} conds={opcoesCliente} onSave={salvarItem} onClose={() => setModal(null)} />}
      {modal?.tipo === "servico" && <FormServico data={modal.data} conds={opcoesCliente} onSave={salvarServico} onClose={() => setModal(null)} />}
      {modal?.tipo === "orcamento" && <FormOrcamento data={modal.data} linhasIniciais={modal.linhas} conds={opcoesCliente} onSave={salvarOrcamento} onClose={() => setModal(null)} />}
      {modal?.tipo === "manut" && <FormManut item={modal.data} onConfirmar={confirmarManut} onClose={() => setModal(null)} />}
      {modal?.tipo === "concluir" && <FormConcluir servico={modal.data} onConfirmar={concluirServico} onClose={() => setModal(null)} />}
    </div>
  );
}

function SecaoTipo({ tipo, itens, nomeCliente, onAdd, onManut, onEdit, onDel }) {
  const t = TIPOS_ITEM[tipo];
  const vencidos = itens.filter((i) => diasAte(i.validade) < 0).length;
  const proximos = itens.filter((i) => { const d = diasAte(i.validade); return d >= 0 && d <= 30; }).length;
  const ok = itens.length - vencidos - proximos;
  return (
    <div className="fade">
      {/* Cabeçalho colorido do tipo */}
      <div className="glass" style={{ padding: "18px 22px", marginBottom: 18, display: "flex", alignItems: "center", gap: 18, borderLeft: `6px solid ${t.cor}` }}>
        <div style={{ width: 58, height: 58, borderRadius: 16, display: "grid", placeItems: "center", background: `${t.cor}1A`, color: t.cor, fontWeight: 800, fontSize: 17, letterSpacing: 1 }}>{t.cod}</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: TITULO }}>{t.label}</h2>
          <div style={{ fontSize: 12.5, color: MUTED }}>Revisão a cada {t.validadeMeses} {t.validadeMeses === 1 ? "mês" : "meses"} · {itens.length} cadastrado{itens.length === 1 ? "" : "s"}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <MiniStat n={ok} label="regulares" cor={VERDE} />
          <MiniStat n={proximos} label="a vencer" cor={AMARELO} />
          <MiniStat n={vencidos} label="vencidos" cor={VERMELHO} />
          <button className="app-btn btn-primary" onClick={onAdd}>+ Cadastrar</button>
        </div>
      </div>
      <div className="glass" style={{ overflow: "hidden" }}>
        <table><thead><tr><th>Local</th><th>Condomínio</th><th>Última</th><th>Validade</th><th>Status</th><th></th></tr></thead>
          <tbody>{itens.map((i) => (
            <tr key={i.id}>
              <td style={{ fontWeight: 600 }}>{i.local}</td>
              <td>{nomeCliente(i)}</td>
              <td>{fmtData(i.ultima)}</td>
              <td>{fmtData(i.validade)}</td>
              <td><ItemStatus validade={i.validade} /></td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="app-btn btn-ghost" onClick={() => onManut(i)}>Registrar manutenção</button>{" "}
                <button className="app-btn btn-ghost" onClick={() => onEdit(i)}>Editar</button>{" "}
                <button className="app-btn btn-ghost" onClick={() => onDel(i.id)}>×</button>
              </td>
            </tr>))}
            {itens.length === 0 && <tr><td colSpan={6} style={{ color: MUTED, padding: 22 }}>Nenhum registro cadastrado nesta categoria. Utilize o botão “+ Cadastrar”.</td></tr>}
          </tbody></table>
      </div>
    </div>
  );
}
function MiniStat({ n, label, cor }) {
  return (
    <div style={{ textAlign: "center", minWidth: 62, padding: "4px 8px", borderRadius: 12, background: `${cor}14` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: cor, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 600 }}>{label}</div>
    </div>
  );
}
function RelatorioMensal({ servicos, nomeCliente }) {
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  // Agrupa por ano-mês (chave "AAAA-MM"), do mais recente para o mais antigo
  const grupos = {};
  servicos.forEach((s) => {
    const chave = s.data.slice(0, 7);
    (grupos[chave] = grupos[chave] || []).push(s);
  });
  const chaves = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

  return (
    <div className="fade">
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: TITULO }}>Serviços por mês</h2>
        <div style={{ fontSize: 12.5, color: MUTED }}>Serviços executados agrupados por período, com o total faturado em cada mês</div>
      </div>
      {chaves.length === 0 && <div className="glass" style={{ padding: 26, color: MUTED }}>Nenhum serviço registrado.</div>}
      {chaves.map((chave) => {
        const [ano, mes] = chave.split("-");
        const lista = grupos[chave].sort((a, b) => a.data.localeCompare(b.data));
        const total = lista.reduce((t, s) => t + valorEfetivo(s), 0);
        const faturado = lista.filter((s) => s.status === "paga").reduce((t, s) => t + valorEfetivo(s), 0);
        return (
          <div key={chave} className="glass" style={{ overflow: "hidden", marginBottom: 18 }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800, color: TITULO, fontSize: 16 }}>{MESES[parseInt(mes, 10) - 1]} / {ano}</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: TITULO, background: "rgba(127,175,232,.12)", padding: "3px 10px", borderRadius: 999 }}>{lista.length} {lista.length === 1 ? "serviço" : "serviços"}</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 22, fontSize: 13 }}>
                <span style={{ color: MUTED }}>Total: <strong style={{ color: TITULO }}>{brl(total)}</strong></span>
                <span style={{ color: MUTED }}>Recebido: <strong style={{ color: VERDE }}>{brl(faturado)}</strong></span>
              </div>
            </div>
            <table><thead><tr><th>Data</th><th>Serviço</th><th>Condomínio</th><th>Estimado</th><th>Real</th><th>Execução</th><th>Pgto</th></tr></thead>
              <tbody>{lista.map((s) => (
                <tr key={s.id}>
                  <td>{fmtData(s.data)}</td>
                  <td>{s.titulo}</td>
                  <td>{nomeCliente(s)}</td>
                  <td style={{ color: MUTED }}>{brl(s.valorEstimado)}</td>
                  <td style={{ fontWeight: 700 }}>{s.valor > 0 ? brl(s.valor) : "—"}</td>
                  <td>{s.executadoEm ? fmtData(s.executadoEm) : <Badge cor={MUTED}>Pendente</Badge>}</td>
                  <td><Badge cor={STATUS_NOTA[s.status].cor}>{STATUS_NOTA[s.status].label}</Badge></td>
                </tr>))}</tbody></table>
          </div>
        );
      })}
    </div>
  );
}
// ---------------------------------------------------------------------------
// Animação de construção — uma linha sobe em espiral e, ao longo do próprio
// traço, materializa a estrutura de um edifício. Recebe "prog" (0 a 1).
// ---------------------------------------------------------------------------
function TorreConstrucao({ ativo, prog }) {
  const CX = 130, TOPO = 40, BASE = 250;    // eixo e limites verticais
  const RX = 52, RY = 15;                    // raio da espiral (elipse em perspectiva)
  const VOLTAS = 6;                          // número de voltas da hélice
  const N = 240;                             // resolução do traço

  // Gera os pontos da espiral (de baixo para cima)
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N;                         // 0..1 ao longo do traço
    const ang = f * VOLTAS * Math.PI * 2;
    const y = BASE - f * (BASE - TOPO);
    const raioF = 1 - f * 0.5;               // afunila para o topo
    const x = CX + Math.cos(ang) * RX * raioF;
    const yy = y + Math.sin(ang) * RY * raioF;
    pts.push([x, yy, y, ang, raioF]);
  }
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

  // Comprimento aproximado do traço para animar o "desenho"
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const desenhado = Math.floor(prog * N); // quantos pontos já foram traçados

  // Montantes verticais do edifício (4 cantos), revelados conforme a espiral sobe
  const montantes = [0, 0.25, 0.5, 0.75].map((off) => {
    const ang0 = off * Math.PI * 2;
    const topX = CX + Math.cos(ang0) * RX * 0.5;
    const botX = CX + Math.cos(ang0) * RX;
    const topYo = Math.sin(ang0) * RY * 0.5;
    const botYo = Math.sin(ang0) * RY;
    return { botX, topX, botY: BASE + botYo, topY: TOPO + topYo };
  });

  // Anéis horizontais (lajes) nos níveis já alcançados pela espiral
  const niveis = [0, 1, 2, 3, 4, 5, 6];

  return (
    <svg viewBox="0 0 260 290" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#28B6E8" />
          <stop offset="100%" stopColor="#7FE1FF" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#28B6E8" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#28B6E8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* halo */}
      <ellipse cx={CX} cy="150" rx="120" ry="135" fill="url(#glow)" style={{ opacity: ativo ? 1 : 0, transition: "opacity 1s ease" }} />

      {/* terreno */}
      <ellipse cx={CX} cy={BASE} rx={RX + 6} ry={RY + 3} fill="none" stroke="#28B6E8" strokeWidth="1" opacity={ativo ? 0.5 : 0}
        style={{ transition: "opacity .6s ease" }} />

      {/* montantes do edifício — sobem acompanhando o progresso */}
      {montantes.map((m, i) => {
        const p = Math.min(prog * 1.1, 1);
        const curX = m.botX + (m.topX - m.botX) * p;
        const curY = m.botY + (m.topY - m.botY) * p;
        return <line key={i} x1={m.botX} y1={m.botY} x2={curX} y2={curY} stroke="#28B6E8" strokeWidth="1.2" opacity={ativo ? 0.55 : 0}
          style={{ transition: "opacity .5s ease" }} />;
      })}

      {/* anéis / lajes revelados conforme a espiral alcança cada nível */}
      {niveis.map((n) => {
        const f = n / (niveis.length - 1);
        const y = BASE - f * (BASE - TOPO);
        const raioF = 1 - f * 0.5;
        const visivel = ativo && prog >= f * 0.92;
        return (
          <ellipse key={n} cx={CX} cy={y} rx={RX * raioF} ry={RY * raioF} fill="none" stroke="url(#edge)" strokeWidth="1"
            opacity={visivel ? 0.7 : 0} style={{ transition: "opacity .4s ease" }} />
        );
      })}

      {/* A ESPIRAL — traço que se desenha progressivamente */}
      <path d={d} fill="none" stroke="url(#edge)" strokeWidth="2.4" strokeLinecap="round"
        style={{
          strokeDasharray: len,
          strokeDashoffset: ativo ? len * (1 - prog) : len,
          transition: "stroke-dashoffset .12s linear",
          filter: "drop-shadow(0 0 5px rgba(40,182,232,.7))",
        }} />

      {/* ponto luminoso na cabeça da espiral (onde está sendo "construído") */}
      {ativo && prog > 0 && prog < 1 && pts[desenhado] && (
        <>
          <circle cx={pts[desenhado][0]} cy={pts[desenhado][1]} r="4.5" fill="#7FE1FF" style={{ filter: "drop-shadow(0 0 8px #7FE1FF)" }} />
          <circle cx={pts[desenhado][0]} cy={pts[desenhado][1]} r="8" fill="none" stroke="#7FE1FF" strokeWidth="1" opacity="0.5">
            <animate attributeName="r" values="6;11;6" dur="1s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="1s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* topo concluído — antena com sinalização */}
      <g style={{ opacity: prog >= 0.96 ? 1 : 0, transition: "opacity .5s ease" }}>
        <line x1={CX} y1={TOPO} x2={CX} y2={TOPO - 16} stroke="url(#edge)" strokeWidth="1.5" />
        <circle cx={CX} cy={TOPO - 18} r="3" fill="#E5584F">
          <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

const ETAPAS_OBRA = [
  "Autenticando credenciais",
  "Nivelando fundação",
  "Erguendo estrutura",
  "Instalando sistemas prediais",
  "Integrando dados de gestão",
  "Ambiente pronto",
];

function TelaLogin({ onEntrar }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [fase, setFase] = useState("form"); // form -> construindo
  const [erro, setErro] = useState("");
  const [prog, setProg] = useState(0);       // 0 a 1 (traçado da espiral)
  const [etapa, setEtapa] = useState(0);

  // PREVIEW: enquanto digita, a espiral se traça parcialmente (até ~40%)
  const preencheu = Math.min(login.length / 6, 1) * 0.2 + Math.min(senha.length / 6, 1) * 0.2;
  useEffect(() => {
    if (fase === "construindo") return;
    // anima suavemente até o alvo de preview
    let raf;
    const passo = () => {
      setProg((p) => {
        const alvo = preencheu;
        const np = p + (alvo - p) * 0.15;
        if (Math.abs(alvo - np) > 0.002) raf = requestAnimationFrame(passo);
        return np;
      });
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [preencheu, fase]);

  // CONSTRUÇÃO: ao entrar, completa a espiral de onde estava até 100%
  useEffect(() => {
    if (fase !== "construindo") return;
    const inicio = performance.now();
    const partida = prog;                    // continua de onde o preview parou
    const DUR = 3200;
    let raf;
    const tick = (t) => {
      const avanco = Math.min((t - inicio) / DUR, 1);
      const p = partida + (1 - partida) * avanco;
      setProg(p);
      setEtapa(Math.min(Math.floor(p * ETAPAS_OBRA.length), ETAPAS_OBRA.length - 1));
      if (avanco < 1) raf = requestAnimationFrame(tick);
      else {
        const nome = login.trim().split(/[.@\s]/)[0].replace(/^\w/, (c) => c.toUpperCase());
        setTimeout(() => onEntrar(nome), 500);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const [entrando, setEntrando] = useState(false);
  const entrar = async () => {
    if (!login.trim()) { setErro("Informe o usuário para continuar."); return; }
    if (!senha) { setErro("Informe a senha."); return; }
    setErro("");
    if (!supabaseConfigurado) {
      // Sem banco configurado: segue apenas com a animação (modo demonstração)
      setFase("construindo");
      return;
    }
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: login.trim(), password: senha });
    setEntrando(false);
    if (error) { setErro("Usuário ou senha inválidos."); return; }
    setFase("construindo");
  };

  const construindo = fase === "construindo";
  const codigoProjeto = "NRM-" + (login.trim() ? login.trim().slice(0, 3).toUpperCase().padEnd(3, "X") : "000") + "-26";
  // a espiral fica "ativa" (visível) assim que o usuário começa a preencher
  const espiralAtiva = construindo || login.length + senha.length > 0;

  return (
    <div className="login-wrap" style={{ minHeight: "100vh", display: "flex", fontFamily: "'Inter', system-ui, sans-serif",
      background: "radial-gradient(1200px 700px at 20% -10%, #10345f 0%, transparent 55%), radial-gradient(900px 600px at 110% 20%, #0a2748 0%, transparent 50%), #061626" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform: translateY(16px);} to { opacity:1; transform:none; } }
        @keyframes gridmove { 0% { background-position:0 0; } 100% { background-position:0 40px; } }
        @keyframes hudspin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @keyframes flick { 0%,100%{opacity:.3;} 50%{opacity:1;} }
        .login-in { animation: fadeUp .6s ease both; }
        .login-input { width:100%; padding:13px 15px; border-radius:11px; font-size:14px; color:#eaf3ff;
          background:rgba(255,255,255,.05); border:1px solid rgba(127,225,255,.22); outline:none; transition: border .2s, box-shadow .2s; }
        .login-input::placeholder { color:#5f7ba0; }
        .login-input:focus { border-color:#28B6E8; box-shadow:0 0 0 3px rgba(40,182,232,.2); }
        .login-btn { width:100%; margin-top:20px; padding:14px; border:none; border-radius:11px; cursor:pointer;
          font-weight:800; font-size:14px; letter-spacing:.4px; color:#04121f;
          background: linear-gradient(135deg, #28B6E8, #7FE1FF); transition: transform .15s, box-shadow .25s; }
        .login-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(40,182,232,.35); }
        .login-btn:active:not(:disabled) { transform: translateY(0) scale(.99); }
        .login-btn:disabled { opacity:.7; cursor:default; }
        .hud-ring { position:absolute; border:1px solid rgba(127,225,255,.18); border-radius:50%; }
        @media (max-width: 860px) {
          .login-wrap { flex-direction:column !important; }
          .login-visual { flex:none !important; min-height:300px; width:100%; padding:24px !important; }
          .login-form { max-width:100% !important; width:100%; border-left:none !important;
            border-top:1px solid rgba(127,225,255,.12); padding:28px 22px 40px !important; }
        }
      `}</style>

      {/* Painel esquerdo — construção + HUD */}
      <div className="login-visual" style={{ flex: 1.2, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 40, overflow: "hidden",
        backgroundImage: "linear-gradient(rgba(127,225,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(127,225,255,.06) 1px, transparent 1px)",
        backgroundSize: "40px 40px", animation: "gridmove 6s linear infinite" }}>

        {/* anéis de HUD girando ao fundo */}
        <div className="hud-ring" style={{ width: 460, height: 460, animation: "hudspin 40s linear infinite" }} />
        <div className="hud-ring" style={{ width: 360, height: 360, borderStyle: "dashed", animation: "hudspin 26s linear infinite reverse" }} />

        {/* cantos técnicos */}
        {[["8px", "8px", "0", "0"], ["8px", "auto", "0", "8px"], ["auto", "8px", "8px", "0"], ["auto", "auto", "8px", "8px"]].map((c, i) => (
          <div key={i} style={{ position: "absolute", top: c[0], right: c[1], bottom: c[2], left: c[3], width: 26, height: 26,
            borderTop: i < 2 ? "2px solid rgba(127,225,255,.4)" : "none", borderBottom: i >= 2 ? "2px solid rgba(127,225,255,.4)" : "none",
            borderLeft: i % 2 === 0 ? "2px solid rgba(127,225,255,.4)" : "none", borderRight: i % 2 === 1 ? "2px solid rgba(127,225,255,.4)" : "none", margin: 22 }} />
        ))}

        {/* código de projeto no topo */}
        <div style={{ position: "absolute", top: 40, left: 0, right: 0, textAlign: "center", color: "#4f6c93", fontSize: 11, letterSpacing: 3, fontFamily: "monospace" }}>
          PROJETO {codigoProjeto} · {construindo ? "EM EXECUÇÃO" : "AGUARDANDO ACESSO"}
        </div>

        <div style={{ width: 300, height: 320, position: "relative", zIndex: 2 }}>
          <TorreConstrucao ativo={espiralAtiva} prog={prog} />
        </div>

        {/* etapa + barra de progresso */}
        <div style={{ width: 340, marginTop: 6, minHeight: 56, zIndex: 2 }}>
          {construindo ? (
            <div className="login-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ color: "#7FE1FF", fontWeight: 700, letterSpacing: .5, fontSize: 13 }}>{ETAPAS_OBRA[etapa]}</span>
                <span style={{ color: "#eaf3ff", fontWeight: 800, fontSize: 15, fontFamily: "monospace" }}>{Math.round(prog * 100)}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "rgba(127,225,255,.12)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${prog * 100}%`, borderRadius: 999, background: "linear-gradient(90deg, #28B6E8, #7FE1FF)", boxShadow: "0 0 12px rgba(40,182,232,.6)", transition: "width .1s linear" }} />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {ETAPAS_OBRA.map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= etapa ? "#28B6E8" : "rgba(127,225,255,.15)", transition: "background .3s" }} />
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#4f6c93", fontWeight: 600, letterSpacing: 3, fontSize: 12 }}>ENGENHARIA · GESTÃO PREDIAL</div>
          )}
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="login-form" style={{ flex: 1, maxWidth: 460, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 52px",
        background: "rgba(4,14,26,.55)", backdropFilter: "blur(12px)", borderLeft: "1px solid rgba(127,225,255,.12)" }}>
        <div className="login-in">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 30 }}>
            <LogoN size={48} />
            <div>
              <div style={{ color: "#fff", fontWeight: 800, letterSpacing: 2, fontSize: 22 }}>NORUM</div>
              <div style={{ color: "#5f7ba0", fontSize: 11, letterSpacing: 1.5 }}>ENGENHARIA</div>
            </div>
          </div>
          <h1 style={{ color: "#eaf3ff", fontSize: 24, margin: "0 0 6px" }}>Acesso ao sistema</h1>
          <p style={{ color: "#5f7ba0", fontSize: 13.5, margin: "0 0 26px" }}>Plataforma de gestão predial e manutenção</p>

          <label style={{ color: "#9fb6d6", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 7 }}>Usuário</label>
          <input className="login-input" value={login} disabled={construindo} onChange={(e) => setLogin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="nome de usuário ou e-mail" />

          <label style={{ color: "#9fb6d6", fontSize: 12, fontWeight: 700, display: "block", margin: "16px 0 7px" }}>Senha</label>
          <input className="login-input" type="password" value={senha} disabled={construindo} onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="••••••••" />

          {erro && <div style={{ color: "#FF9B94", fontSize: 12.5, marginTop: 12 }}>{erro}</div>}

          <button className="login-btn" onClick={entrar} disabled={construindo || entrando}>
            {construindo ? "Preparando ambiente…" : entrando ? "Verificando…" : "Entrar na plataforma"}
          </button>
          <div style={{ color: "#3f5a7d", fontSize: 11.5, textAlign: "center", marginTop: 22 }}>
            NORUM Engenharia · uso corporativo restrito
          </div>
        </div>
      </div>
    </div>
  );
}

function Saudacao({ usuario, onFim }) {
  const [sai, setSai] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setSai(true), 2200);
    const t2 = setTimeout(onFim, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onFim]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center",
      background: "radial-gradient(900px 600px at 50% 30%, #10345f 0%, #061626 70%)",
      opacity: sai ? 0 : 1, transition: "opacity .6s ease", pointerEvents: sai ? "none" : "auto" }}>
      <style>{`
        @keyframes riseIn { from { opacity:0; transform: translateY(20px);} to { opacity:1; transform:none; } }
        @keyframes ringspin { from { transform: rotate(0);} to { transform: rotate(360deg);} }
        @keyframes glowpulse { 0%,100%{ opacity:.4; transform:scale(1);} 50%{ opacity:.8; transform:scale(1.05);} }
      `}</style>
      <div style={{ position: "absolute", width: 420, height: 420, border: "1px solid rgba(127,225,255,.18)", borderRadius: "50%", animation: "ringspin 30s linear infinite" }} />
      <div style={{ position: "absolute", width: 320, height: 320, border: "1px dashed rgba(127,225,255,.25)", borderRadius: "50%", animation: "ringspin 20s linear infinite reverse" }} />
      <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(40,182,232,.25), transparent 70%)", animation: "glowpulse 3s ease-in-out infinite" }} />
      <div style={{ textAlign: "center", animation: "riseIn .7s ease both", position: "relative" }}>
        <div style={{ display: "inline-block", marginBottom: 22 }}><LogoN size={64} /></div>
        <div style={{ color: "#7FE1FF", fontSize: 13, letterSpacing: 3, fontWeight: 700, marginBottom: 10 }}>BEM-VINDO</div>
        <h1 style={{ color: "#fff", fontSize: 38, margin: 0, fontWeight: 800 }}>Olá, {usuario}</h1>
        <p style={{ color: "#9fb6d6", fontSize: 17, marginTop: 12 }}>O que faremos hoje?</p>
      </div>
    </div>
  );
}

function KPI({ titulo, valor, cor, sub }) {
  return (
    <div className="glass fade" style={{ padding: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: cor }} />
      <div style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{titulo}</div>
      <div className="valor" style={{ fontSize: 30, fontWeight: 800, color: cor, margin: "6px 0" }}>{valor}</div>
      <div style={{ fontSize: 12, color: MUTED }}>{sub}</div>
    </div>
  );
}
function Secao({ titulo, onAdd, children }) {
  return (
    <div className="fade">
      <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: TITULO }}>{titulo}</h2>
        <button className="app-btn btn-primary" style={{ marginLeft: "auto" }} onClick={onAdd}>+ Cadastrar</button>
      </div>
      <div className="glass" style={{ overflow: "hidden" }}>{children}</div>
    </div>
  );
}
function Modal({ children, onClose, titulo, largura }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(7,27,51,.45)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="glass fade" style={{ padding: 26, width: largura || 470, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", background: CARD_SOLID }}>
        {titulo && <h3 style={{ marginTop: 0, color: TITULO }}>{titulo}</h3>}{children}
      </div>
    </div>
  );
}
function Acoes({ onSave, onClose }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
      <button className="app-btn btn-primary" onClick={onSave}>Salvar</button>
      <button className="app-btn btn-ghost" onClick={onClose}>Cancelar</button>
    </div>
  );
}
function DetalheCond({ cond, itens, onEditar, onExcluir, onClose }) {
  const linha = (rotulo, valor, extra) => (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${LINE}` }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: MUTED, fontWeight: 700 }}>{rotulo}</div>
      <div style={{ fontSize: 16, color: INK, marginTop: 3, fontWeight: 600 }}>{valor || "—"} {extra}</div>
    </div>
  );
  const telLimpo = (cond.telefone || "").replace(/\D/g, "");
  return (
    <Modal titulo={null} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
        <div style={{ width: 54, height: 54, borderRadius: 15, display: "grid", placeItems: "center", background: `linear-gradient(135deg, ${NAVY}, ${CIANO})`, color: "#fff", fontWeight: 800, fontSize: 22 }}>{cond.nome.charAt(0)}</div>
        <div>
          <h3 style={{ margin: 0, color: TITULO, fontSize: 20 }}>{cond.nome}</h3>
          <div style={{ fontSize: 12.5, color: MUTED }}>{itens.length} {itens.length === 1 ? "item monitorado" : "itens monitorados"}</div>
        </div>
      </div>
      {linha("Síndico(a)", cond.sindico)}
      {linha("Telefone do síndico", cond.telefone,
        telLimpo && <a href={`https://wa.me/55${telLimpo}`} target="_blank" rel="noreferrer" style={{ marginLeft: 8, fontSize: 12.5, fontWeight: 700, color: VERDE, textDecoration: "none" }}>WhatsApp ↗</a>)}
      {linha("Administradora", cond.administradora)}
      {linha("Endereço", cond.endereco)}
      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <button className="app-btn btn-primary" onClick={onEditar}>Editar</button>
        <button className="app-btn btn-ghost" onClick={onClose}>Fechar</button>
        <button className="app-btn btn-ghost" style={{ marginLeft: "auto", color: VERMELHO }} onClick={onExcluir}>Excluir</button>
      </div>
    </Modal>
  );
}
function FormCond({ data, onSave, onClose }) {
  const [f, setF] = useState({ nome: "", sindico: "", telefone: "", administradora: "", endereco: "", ...data });
  return (
    <Modal titulo={data.id ? "Editar condomínio" : "Cadastrar condomínio"} onClose={onClose}>
      <label>Nome do condomínio</label><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Residencial Araucária" />
      <label>Síndico(a) responsável</label><input value={f.sindico} onChange={(e) => setF({ ...f, sindico: e.target.value })} placeholder="Nome completo do síndico" />
      <label>Telefone de contato</label><input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} placeholder="(42) 99999-9999" />
      <label>Administradora responsável</label><input value={f.administradora} onChange={(e) => setF({ ...f, administradora: e.target.value })} placeholder="Ex.: Nexus Administração" />
      <label>Endereço completo</label><input value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} />
      <Acoes onSave={() => f.nome && onSave(f)} onClose={onClose} />
    </Modal>
  );
}
function FormItem({ data, conds, onSave, onClose }) {
  const [f, setF] = useState({ tipo: "extintor", local: "", ultima: hoje(), validade: "", clienteAvulso: "", condId: conds[0]?.id, ...data });
  const validadeAuto = f.ultima ? addMeses(f.ultima, TIPOS_ITEM[f.tipo].validadeMeses) : "";
  const ehAvulso = f.condId === AVULSO;
  return (
    <Modal titulo={data.id ? "Editar registro" : "Cadastrar registro"} onClose={onClose}>
      <label>Cliente</label>
      <select value={f.condId} onChange={(e) => setF({ ...f, condId: e.target.value })}>{conds.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
      {ehAvulso && (
        <>
          <label>Nome do cliente (avulso)</label>
          <input value={f.clienteAvulso} onChange={(e) => setF({ ...f, clienteAvulso: e.target.value })} placeholder="Ex.: João Silva, Loja Central…" />
        </>
      )}
      <label>Categoria</label>
      <select value={f.tipo} disabled={!data.id} onChange={(e) => setF({ ...f, tipo: e.target.value })} style={!data.id ? { background: "rgba(40,182,232,.10)", color: TITULO, fontWeight: 700 } : undefined}>{Object.entries(TIPOS_ITEM).map(([k, v]) => <option key={k} value={k}>{v.label} — revisão a cada {v.validadeMeses} meses</option>)}</select>
      <label>Local / identificação</label><input value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} placeholder="Ex.: Garagem G1, Bloco A" />
      <label>Data da última manutenção</label><input type="date" value={f.ultima} onChange={(e) => setF({ ...f, ultima: e.target.value })} />
      <label>Validade (em branco = cálculo automático: {fmtData(validadeAuto)})</label><input type="date" value={f.validade} onChange={(e) => setF({ ...f, validade: e.target.value })} />
      <Acoes onSave={() => f.local && onSave(f)} onClose={onClose} />
    </Modal>
  );
}
function FormOrcamento({ data, linhasIniciais, conds, onSave, onClose }) {
  const [f, setF] = useState({ titulo: "", dataEmissao: hoje(), validadeDias: 15, observacoes: "", dadosContratante: "", status: "rascunho", clienteAvulso: "", condId: conds[0]?.id, ...data });
  const [linhas, setLinhas] = useState(
    linhasIniciais && linhasIniciais.length
      ? linhasIniciais.map((l) => ({ ...l }))
      : [{ descricao: "", quantidade: 1, valorUnitario: 0 }]
  );
  const ehAvulso = f.condId === AVULSO;
  const total = totalOrc(linhas);

  const mudaLinha = (i, campo, valor) => setLinhas(linhas.map((l, idx) => idx === i ? { ...l, [campo]: valor } : l));
  const addLinha = () => setLinhas([...linhas, { descricao: "", quantidade: 1, valorUnitario: 0 }]);
  const removeLinha = (i) => setLinhas(linhas.length > 1 ? linhas.filter((_, idx) => idx !== i) : linhas);

  return (
    <Modal titulo={data.id ? `Editar orçamento ORC-${String(data.numero).padStart(4, "0")}` : "Novo orçamento"} onClose={onClose} largura={620}>
      <label>Cliente</label>
      <select value={f.condId} onChange={(e) => setF({ ...f, condId: e.target.value })}>{conds.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
      {ehAvulso && (
        <>
          <label>Nome do cliente (avulso)</label>
          <input value={f.clienteAvulso} onChange={(e) => setF({ ...f, clienteAvulso: e.target.value })} placeholder="Ex.: Loja Central" />
        </>
      )}
      <label>Objeto do orçamento</label>
      <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Manutenção do sistema de combate a incêndio" />

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label>Data de emissão</label>
          <input type="date" value={f.dataEmissao} onChange={(e) => setF({ ...f, dataEmissao: e.target.value })} />
        </div>
        <div style={{ width: 150 }}>
          <label>Validade (dias)</label>
          <input type="number" value={f.validadeDias} onChange={(e) => setF({ ...f, validadeDias: parseInt(e.target.value) || 15 })} />
        </div>
      </div>

      <label>Itens do orçamento</label>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: 10 }}>
        <div style={{ display: "flex", gap: 8, fontSize: 11, color: MUTED, fontWeight: 700, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>DESCRIÇÃO</div>
          <div style={{ width: 62 }}>QTD.</div>
          <div style={{ width: 96 }}>UNITÁRIO</div>
          <div style={{ width: 26 }} />
        </div>
        {linhas.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "center" }}>
            <input style={{ flex: 1 }} value={l.descricao} onChange={(e) => mudaLinha(i, "descricao", e.target.value)} placeholder="Ex.: Recarga de extintor PQS 6kg" />
            <input style={{ width: 62 }} type="number" step="0.01" value={l.quantidade} onChange={(e) => mudaLinha(i, "quantidade", parseFloat(e.target.value) || 0)} />
            <input style={{ width: 96 }} type="number" step="0.01" value={l.valorUnitario} onChange={(e) => mudaLinha(i, "valorUnitario", parseFloat(e.target.value) || 0)} />
            <button className="app-btn btn-ghost" style={{ width: 26, padding: "6px 0" }} onClick={() => removeLinha(i)}>×</button>
          </div>
        ))}
        <button className="app-btn btn-ghost" style={{ marginTop: 4 }} onClick={addLinha}>+ Adicionar item</button>
        <div style={{ textAlign: "right", marginTop: 12, fontSize: 17, fontWeight: 800, color: TITULO }}>Total: {brl(total)}</div>
      </div>

      <label>Observações (aparecem no PDF)</label>
      <textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} rows={3}
        placeholder="Ex.: Prazo de execução de 5 dias úteis. Pagamento em até 30 dias."
        style={{ width: "100%", padding: "10px 12px", border: `1px solid rgba(127,175,232,.20)`, borderRadius: 10, fontSize: 14, background: "rgba(6,22,38,.6)", color: INK, fontFamily: "inherit", resize: "vertical" }} />

      <label>Dados do contratante (aparecem no rodapé do PDF)</label>
      <textarea value={f.dadosContratante} onChange={(e) => setF({ ...f, dadosContratante: e.target.value })} rows={3}
        placeholder={"Ex.:\nSolarpreve Empreendimentos\nCNPJ 32.050.508/0001-90"}
        style={{ width: "100%", padding: "10px 12px", border: `1px solid rgba(127,175,232,.20)`, borderRadius: 10, fontSize: 14, background: "rgba(6,22,38,.6)", color: INK, fontFamily: "inherit", resize: "vertical" }} />

      <Acoes onSave={() => f.titulo && onSave(f, linhas)} onClose={onClose} />
    </Modal>
  );
}
function FormManut({ item, onConfirmar, onClose }) {
  const [dataManut, setDataManut] = useState(hoje());
  const novaValidade = addMeses(dataManut, TIPOS_ITEM[item.tipo].validadeMeses);
  return (
    <Modal titulo="Registrar manutenção" onClose={onClose}>
      <div style={{ fontSize: 14, color: MUTED, marginBottom: 4 }}>{TIPOS_ITEM[item.tipo].label} · {item.local}</div>
      <label>Data em que a manutenção foi (ou será) realizada</label>
      <input type="date" value={dataManut} onChange={(e) => setDataManut(e.target.value)} />
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 10 }}>Nova validade calculada: <strong style={{ color: TITULO }}>{fmtData(novaValidade)}</strong> (revisão a cada {TIPOS_ITEM[item.tipo].validadeMeses} meses)</div>
      <Acoes onSave={() => dataManut && onConfirmar(item, dataManut)} onClose={onClose} />
    </Modal>
  );
}
function FormConcluir({ servico, onConfirmar, onClose }) {
  const [dataExec, setDataExec] = useState(hoje());
  const [valorReal, setValorReal] = useState(servico.valor > 0 ? servico.valor : servico.valorEstimado || 0);
  return (
    <Modal titulo="Concluir serviço" onClose={onClose}>
      <div style={{ fontSize: 14, color: MUTED, marginBottom: 4 }}>{servico.titulo}</div>
      <label>Data de execução</label>
      <input type="date" value={dataExec} onChange={(e) => setDataExec(e.target.value)} />
      <label>Valor real cobrado (R$) — estimado: {brl(servico.valorEstimado || 0)}</label>
      <input type="number" step="0.01" value={valorReal} onChange={(e) => setValorReal(parseFloat(e.target.value) || 0)} />
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 10 }}>Após concluir, o serviço segue para o controle financeiro como <strong style={{ color: TITULO }}>pgto pendente</strong> até você marcar como pago.</div>
      <Acoes onSave={() => dataExec && onConfirmar(servico, dataExec, valorReal)} onClose={onClose} />
    </Modal>
  );
}
function FormServico({ data, conds, onSave, onClose }) {
  const [f, setF] = useState({ titulo: "", data: hoje(), valorEstimado: 0, valor: 0, executadoEm: "", status: "nao_emitida", nfNumero: "", pgtoData: "", clienteAvulso: "", condId: conds[0]?.id, ...data });
  const ehAvulso = f.condId === AVULSO;
  return (
    <Modal titulo={data.id ? "Editar serviço" : "Cadastrar serviço"} onClose={onClose}>
      <label>Cliente</label>
      <select value={f.condId} onChange={(e) => setF({ ...f, condId: e.target.value })}>{conds.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
      {ehAvulso && (
        <>
          <label>Nome do cliente (avulso)</label>
          <input value={f.clienteAvulso} onChange={(e) => setF({ ...f, clienteAvulso: e.target.value })} placeholder="Ex.: João Silva, Loja Central…" />
        </>
      )}
      <label>Descrição do serviço</label><input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Recarga de extintores" />
      <label>Data agendada</label><input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
      <label>Preço estimado (R$)</label><input type="number" step="0.01" value={f.valorEstimado} onChange={(e) => setF({ ...f, valorEstimado: parseFloat(e.target.value) || 0 })} />
      <label>Preço real (R$) — deixe 0 se ainda não executado; será pedido ao concluir</label><input type="number" step="0.01" value={f.valor} onChange={(e) => setF({ ...f, valor: parseFloat(e.target.value) || 0 })} />
      <label>Situação fiscal</label>
      <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(STATUS_NOTA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      <label>Número da nota fiscal (se emitida)</label><input value={f.nfNumero} onChange={(e) => setF({ ...f, nfNumero: e.target.value })} />
      <Acoes onSave={() => f.titulo && onSave(f)} onClose={onClose} />
    </Modal>
  );
}
