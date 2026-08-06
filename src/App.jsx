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
  const linhasHtml = linhas.map((l, i) => `
    <tr>
      <td style="padding:9px 8px;border-bottom:1px solid #e6e9ef;color:#8a94a6">${i + 1}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #e6e9ef">${escapeHtml(l.descricao)}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #e6e9ef;text-align:center">${l.quantidade}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #e6e9ef;text-align:right">${brl(l.valorUnitario)}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #e6e9ef;text-align:right;font-weight:700">${brl((l.quantidade || 0) * (l.valorUnitario || 0))}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${num} - NORUM Engenharia</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#0F0F0F; margin:0; font-size:13px; }
  .cab { display:flex; align-items:center; gap:16px; border-bottom:3px solid ${NORUM_AZUL}; padding-bottom:14px; }
  .marca { font-size:26px; font-weight:bold; letter-spacing:3px; color:${NORUM_AZUL}; }
  .sub { font-size:10px; letter-spacing:2px; color:#6b7688; }
  .doc { margin-left:auto; text-align:right; }
  .doc .n { font-size:19px; font-weight:bold; color:${NORUM_AZUL}; }
  .bloco { margin-top:20px; background:#f5f7fa; border-left:4px solid ${NORUM_AZUL}; padding:12px 14px; }
  .rot { font-size:10px; letter-spacing:1px; color:#6b7688; text-transform:uppercase; }
  table { width:100%; border-collapse:collapse; margin-top:20px; }
  th { background:${NORUM_AZUL}; color:#fff; padding:9px 8px; text-align:left; font-size:11px; letter-spacing:.5px; }
  .total { margin-top:14px; text-align:right; font-size:17px; font-weight:bold; color:${NORUM_AZUL}; }
  .obs { margin-top:22px; font-size:12px; white-space:pre-wrap; }
  .rod { margin-top:34px; border-top:1px solid #e6e9ef; padding-top:12px; font-size:11px; color:#6b7688; text-align:center; }
  @media print { .noprint { display:none; } }
</style></head><body>
  <div class="cab">
    <svg width="52" height="52" viewBox="0 0 100 100">
      <polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill="${NORUM_AZUL}"/>
      <polygon points="50,13 83,31 83,69 50,87 17,69 17,31" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.6"/>
      <path d="M36 68 V34 L64 68 V34" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
    <div>
      <div class="marca">NORUM</div>
      <div class="sub">ENGENHARIA E MANUTENÇÃO PREDIAL</div>
    </div>
    <div class="doc">
      <div class="n">${num}</div>
      <div style="font-size:11px;color:#6b7688">Emissão: ${fmtData(orc.dataEmissao)}</div>
      <div style="font-size:11px;color:#6b7688">Válido até: ${fmtData(venc)}</div>
    </div>
  </div>

  <div class="bloco">
    <div class="rot">Cliente</div>
    <div style="font-size:15px;font-weight:bold;color:${NORUM_AZUL};margin-top:2px">${escapeHtml(cliente.nome || "-")}</div>
    ${cliente.endereco ? `<div style="font-size:12px;color:#4a5568">${escapeHtml(cliente.endereco)}</div>` : ""}
    ${cliente.sindico ? `<div style="font-size:12px;color:#4a5568">Responsável: ${escapeHtml(cliente.sindico)}</div>` : ""}
  </div>

  <div style="margin-top:18px">
    <div class="rot">Objeto</div>
    <div style="font-size:15px;font-weight:bold;margin-top:2px">${escapeHtml(orc.titulo)}</div>
  </div>

  <table>
    <thead><tr>
      <th style="width:34px">#</th><th>Descrição dos serviços</th>
      <th style="width:60px;text-align:center">Qtd.</th>
      <th style="width:100px;text-align:right">Unitário</th>
      <th style="width:110px;text-align:right">Total</th>
    </tr></thead>
    <tbody>${linhasHtml}</tbody>
  </table>

  <div class="total">VALOR TOTAL: ${brl(total)}</div>

  ${orc.observacoes ? `<div class="obs"><div class="rot">Observações</div>${escapeHtml(orc.observacoes)}</div>` : ""}

  <div class="rod">
    NORUM Engenharia · Guarapuava/PR · WhatsApp (42) 98814-7090 · @norum_engenharia<br>
    Proposta válida por ${orc.validadeDias || 15} dias a contar da data de emissão.
  </div>

  <div class="noprint" style="text-align:center;margin-top:26px">
    <button onclick="window.print()" style="background:${NORUM_AZUL};color:#fff;border:none;padding:12px 26px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer">
      Salvar como PDF / Imprimir
    </button>
  </div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("O navegador bloqueou a janela. Libere os pop-ups para este site e tente de novo."); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { try { win.print(); } catch (e) {} }, 400);
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
const orcDeLinha = (r) => ({ id: r.id, numero: r.numero, condId: r.condominio_id || AVULSO, clienteAvulso: r.cliente_avulso || "", titulo: r.titulo, dataEmissao: r.data_emissao, validadeDias: r.validade_dias, observacoes: r.observacoes || "", status: r.status, servicoId: r.servico_id || "" });
const orcParaLinha = (o) => ({ condominio_id: nuloSeAvulso(o.condId), cliente_avulso: o.condId === AVULSO ? (o.clienteAvulso || "Avulso") : null, titulo: o.titulo, data_emissao: o.dataEmissao, validade_dias: o.validadeDias || 15, observacoes: o.observacoes || null, status: o.status || "rascunho" });
const orcItemDeLinha = (r) => ({ id: r.id, orcId: r.orcamento_id, descricao: r.descricao, quantidade: Number(r.quantidade), valorUnitario: Number(r.valor_unitario), ordem: r.ordem });

async function carregarTudo() {
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
function LogoN({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="NORUM">
      <polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill={NAVY} stroke="#fff" strokeWidth="4" />
      <polygon points="50,13 83,31 83,69 50,87 17,69 17,31" fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.55" />
      <path d="M36 68 V34 L64 68 V34" fill="none" stroke="#fff" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
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
  const [usuario, setUsuario] = useState(null);      // nome do usuário logado
  const [saudacao, setSaudacao] = useState(false);   // exibe a saudação de boas-vindas
  const [erroBanco, setErroBanco] = useState("");

  // Recarrega tudo do banco
  const recarregar = useCallback(async () => {
    try { setDb(await carregarTudo()); setErroBanco(""); }
    catch (e) { setErroBanco(e.message || "Falha ao carregar dados."); setDb({ condominios: [], itens: [], servicos: [] }); }
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
  if (!db) return <div style={{ padding: 40, fontFamily: "system-ui", color: TITULO }}>Carregando dados…</div>;

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
      `}</style>

      <aside style={{ width: 258, flexShrink: 0, background: `linear-gradient(180deg, ${NAVY_DK}, #071b33)`, color: "#fff",
        padding: "22px 16px", display: "flex", flexDirection: "column", gap: 6, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 6px 18px" }}>
          <LogoN size={44} />
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 1.5, fontSize: 18 }}>NORUM</div>
            <div style={{ fontSize: 10.5, opacity: 0.65, letterSpacing: 0.5 }}>ENGENHARIA · GESTÃO</div>
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.k} className={`nav-item ${aba === n.k ? "active" : ""}`} onClick={() => setAba(n.k)}>
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
        <header style={{ padding: "18px 28px", display: "flex", alignItems: "center", gap: 16, borderBottom: `1px solid ${LINE}` }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, color: TITULO }}>{NAV.find((n) => n.k === aba)?.label}</h1>
            <div style={{ fontSize: 12.5, color: MUTED }}>Gestão de condomínios · manutenção predial</div>
          </div>
          <select value={condFiltro} onChange={(e) => setCondFiltro(e.target.value)} style={{ marginLeft: "auto", width: 250 }}>
            <option value="todos">Todos os condomínios</option>
            {db.condominios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </header>

        <main style={{ padding: 28, flex: 1 }}>
          {aba === "painel" && (
            <div className="fade">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 18, marginBottom: 24 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 18, marginBottom: 22 }}>
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
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Inter', system-ui, sans-serif",
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
      `}</style>

      {/* Painel esquerdo — construção + HUD */}
      <div style={{ flex: 1.2, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 40, overflow: "hidden",
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
      <div style={{ flex: 1, maxWidth: 460, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 52px",
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
      <div style={{ fontSize: 30, fontWeight: 800, color: cor, margin: "6px 0" }}>{valor}</div>
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
  const [f, setF] = useState({ titulo: "", dataEmissao: hoje(), validadeDias: 15, observacoes: "", status: "rascunho", clienteAvulso: "", condId: conds[0]?.id, ...data });
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
