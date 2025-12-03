// Complete Form Templates based on research methodology
// ADM = Administrative (NASA-TLX + HSE-IT)
// OP = Operational (NASA-TLX + ERGOS)

import type { FormQuestion } from "@/components/forms/QuestionEditor";

// ========== NASA-TLX Comparações (15 pares) ==========
const NASA_TLX_COMPARISONS: FormQuestion[] = [
  { id: "info_nasa_comparacoes", type: "info", label: "Comparações NASA-TLX", description: "Escolha entre cada par de escalas, a demanda que predomina (mais presente) no seu trabalho:" },
  { id: "nasa_comp_1", type: "radio", label: "3. Demanda Mental X Demanda Física", required: true, options: ["1 - Demanda Mental", "2 - Demanda Física"] },
  { id: "nasa_comp_2", type: "radio", label: "4. Demanda Temporal X Demanda Física", required: true, options: ["1 - Demanda Temporal", "2 - Demanda Física"] },
  { id: "nasa_comp_3", type: "radio", label: "5. Demanda Temporal X Frustração", required: true, options: ["1 - Demanda Temporal", "2 - Frustração"] },
  { id: "nasa_comp_4", type: "radio", label: "6. Demanda Temporal X Demanda Mental", required: true, options: ["1 - Demanda Temporal", "2 - Demanda Mental"] },
  { id: "nasa_comp_5", type: "radio", label: "7. Performance X Demanda Física", required: true, options: ["1 - Performance", "2 - Demanda Física"] },
  { id: "nasa_comp_6", type: "radio", label: "8. Demanda Temporal X Esforço", required: true, options: ["1 - Demanda Temporal", "2 - Esforço"] },
  { id: "nasa_comp_7", type: "radio", label: "9. Performance X Demanda Mental", required: true, options: ["1 - Performance", "2 - Demanda Mental"] },
  { id: "nasa_comp_8", type: "radio", label: "10. Frustração X Demanda Física", required: true, options: ["1 - Frustração", "2 - Demanda Física"] },
  { id: "nasa_comp_9", type: "radio", label: "11. Performance X Frustração", required: true, options: ["1 - Performance", "2 - Frustração"] },
  { id: "nasa_comp_10", type: "radio", label: "12. Frustração X Demanda Mental", required: true, options: ["1 - Frustração", "2 - Demanda Mental"] },
  { id: "nasa_comp_11", type: "radio", label: "13. Esforço X Demanda Física", required: true, options: ["1 - Esforço", "2 - Demanda Física"] },
  { id: "nasa_comp_12", type: "radio", label: "14. Performance X Esforço", required: true, options: ["1 - Performance", "2 - Esforço"] },
  { id: "nasa_comp_13", type: "radio", label: "15. Esforço X Demanda Mental", required: true, options: ["1 - Esforço", "2 - Demanda Mental"] },
  { id: "nasa_comp_14", type: "radio", label: "16. Demanda Temporal X Performance", required: true, options: ["1 - Demanda Temporal", "2 - Performance"] },
  { id: "nasa_comp_15", type: "radio", label: "17. Esforço X Frustração", required: true, options: ["1 - Esforço", "2 - Frustração"] },
];

// ========== NASA-TLX Percepção (6 escalas 0-100) ==========
const NASA_TLX_PERCEPTION: FormQuestion[] = [
  { id: "info_nasa_percepcao", type: "info", label: "Percepção NASA-TLX", description: "Marque de 0 a 100 como está sua percepção ao seu dia de trabalho:" },
  { id: "nasa_demanda_mental", type: "slider", label: "18. Nível de Demanda Mental", description: "Baixa (0) a Alta (100)", required: true, min: 0, max: 100 },
  { id: "nasa_demanda_fisica", type: "slider", label: "19. Nível de Demanda Física", description: "Baixa (0) a Alta (100)", required: true, min: 0, max: 100 },
  { id: "nasa_demanda_temporal", type: "slider", label: "20. Nível de Demanda Temporal", description: "Baixa (0) a Alta (100)", required: true, min: 0, max: 100 },
  { id: "nasa_performance", type: "slider", label: "21. Nível de Performance", description: "Excelente (0) a Ruim (100) - Escala invertida", required: true, min: 0, max: 100 },
  { id: "nasa_esforco", type: "slider", label: "22. Nível de Esforço/Empenho", description: "Baixo (0) a Alto (100)", required: true, min: 0, max: 100 },
  { id: "nasa_frustracao", type: "slider", label: "23. Nível de Frustração", description: "Baixa (0) a Alta (100)", required: true, min: 0, max: 100 },
];

// ========== HSE-IT (35 questões em 7 dimensões) ==========
const HSEIT_OPTIONS = ["1 - Nunca", "2 - Raramente", "3 - Às vezes", "4 - Frequentemente", "5 - Sempre"];

const HSEIT_QUESTIONS: FormQuestion[] = [
  // Demandas (8 questões)
  { id: "info_hseit_demandas", type: "info", label: "Dimensão: Demandas", description: "Avalie a frequência das situações abaixo no seu trabalho" },
  { id: "hseit_24", type: "radio", label: "24. As exigências de trabalho feitas por colegas e supervisores são difíceis de combinar?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_25", type: "radio", label: "25. Tenho prazos impossíveis de cumprir?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_26", type: "radio", label: "26. Devo trabalhar muito intensamente?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_27", type: "radio", label: "27. Eu não faço algumas tarefas porque tenho muita coisa para fazer?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_28", type: "radio", label: "28. Não tenho possibilidade de fazer pausas suficientes?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_29", type: "radio", label: "29. Recebo pressão para trabalhar em outro horário?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_30", type: "radio", label: "30. Tenho que fazer meu trabalho com muita rapidez?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_31", type: "radio", label: "31. As pausas temporárias são impossíveis de cumprir?", required: true, options: HSEIT_OPTIONS },
  
  // Relacionamentos (4 questões)
  { id: "info_hseit_relacionamentos", type: "info", label: "Dimensão: Relacionamentos", description: "Avalie os relacionamentos no seu ambiente de trabalho" },
  { id: "hseit_32", type: "radio", label: "32. Falam ou se comportam comigo de forma dura?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_33", type: "radio", label: "33. Existem conflitos entre colegas?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_34", type: "radio", label: "34. Sinto que sou perseguido(a) no trabalho (tratamento injusto)?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_35", type: "radio", label: "35. As relações de trabalho são tensas?", required: true, options: HSEIT_OPTIONS },
  
  // Controle (6 questões)
  { id: "info_hseit_controle", type: "info", label: "Dimensão: Controle", description: "Avalie seu controle sobre o trabalho" },
  { id: "hseit_36", type: "radio", label: "36. Posso decidir quando fazer uma pausa?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_37", type: "radio", label: "37. Consideram a minha opinião sobre a velocidade do meu trabalho?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_38", type: "radio", label: "38. Tenho liberdade de escolha de como fazer meu trabalho (método)?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_39", type: "radio", label: "39. Tenho liberdade de escolha para decidir o que fazer do meu trabalho (ordem das tarefas)?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_40", type: "radio", label: "40. Minhas sugestões são consideradas sobre como fazer meu trabalho?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_41", type: "radio", label: "41. O meu horário de trabalho pode ser flexível?", required: true, options: HSEIT_OPTIONS },
  
  // Apoio da Chefia (5 questões)
  { id: "info_hseit_apoio_chefia", type: "info", label: "Dimensão: Apoio da Chefia", description: "Avalie o apoio que recebe da sua chefia" },
  { id: "hseit_42", type: "radio", label: "42. Recebo informações e suporte que me ajudam no trabalho que faço?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_43", type: "radio", label: "43. Posso confiar no meu chefe quando eu tiver problemas no trabalho?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_44", type: "radio", label: "44. Quando algo no trabalho me perturba ou irrita posso falar com meu chefe?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_45", type: "radio", label: "45. Tenho suportado trabalhos emocionalmente exigentes?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_46", type: "radio", label: "46. Meu chefe me incentiva no trabalho?", required: true, options: HSEIT_OPTIONS },
  
  // Apoio dos Colegas (4 questões)
  { id: "info_hseit_apoio_colegas", type: "info", label: "Dimensão: Apoio dos Colegas", description: "Avalie o apoio que recebe dos seus colegas" },
  { id: "hseit_47", type: "radio", label: "47. Quando o trabalho se torna difícil, posso contar com ajuda dos colegas?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_48", type: "radio", label: "48. Meus colegas me ajudam e me dão apoio quando preciso?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_49", type: "radio", label: "49. No trabalho os meus colegas demonstram o respeito que mereço?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_50", type: "radio", label: "50. Os colegas estão disponíveis para escutar os meus problemas de trabalho?", required: true, options: HSEIT_OPTIONS },
  
  // Cargo (5 questões)
  { id: "info_hseit_cargo", type: "info", label: "Dimensão: Cargo", description: "Avalie a clareza do seu cargo e responsabilidades" },
  { id: "hseit_51", type: "radio", label: "51. Tenho clareza sobre o que se espera do meu trabalho?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_52", type: "radio", label: "52. Eu sei como fazer meu trabalho?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_53", type: "radio", label: "53. Estão claras as minhas tarefas e responsabilidades?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_54", type: "radio", label: "54. Os objetivos e metas do meu setor são claros para mim?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_55", type: "radio", label: "55. Eu vejo como o meu trabalho se encaixa nos objetivos da empresa?", required: true, options: HSEIT_OPTIONS },
  
  // Comunicação e Mudanças (3 questões)
  { id: "info_hseit_mudancas", type: "info", label: "Dimensão: Comunicação e Mudanças", description: "Avalie a comunicação sobre mudanças no trabalho" },
  { id: "hseit_56", type: "radio", label: "56. Tenho oportunidade para pedir explicações ao chefe sobre mudanças no trabalho?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_57", type: "radio", label: "57. As pessoas são consultadas sobre mudanças no trabalho?", required: true, options: HSEIT_OPTIONS },
  { id: "hseit_58", type: "radio", label: "58. Quando há mudanças, faço o meu trabalho com o mesmo compromisso?", required: true, options: HSEIT_OPTIONS },
];

// ========== ERGOS Operacional (29 questões em 10 dimensões) ==========
const ERGOS_QUESTIONS: FormQuestion[] = [
  // Pressão de Tempo (3 questões)
  { id: "info_ergos_tempo", type: "info", label: "Sobre Tempo do Trabalho", description: "Avalie aspectos relacionados ao tempo e ritmo de trabalho" },
  { id: "ergos_24", type: "radio", label: "24. Duração do tempo de pausa:", required: true, options: ["Menor que 5% da jornada", "5 a 15% da jornada", "15 a 25% da jornada"] },
  { id: "ergos_25", type: "radio", label: "25. Pode parar a máquina ou processo sem gerar transtorno?", required: true, options: ["Não", "Às vezes", "Sim"] },
  { id: "ergos_26", type: "radio", label: "26. Tem momentos que o ritmo de trabalho pode ser considerado apertado?", required: true, options: ["Não", "Às vezes", "Frequentemente"] },
  
  // Atenção (3 questões)
  { id: "info_ergos_atencao", type: "info", label: "Sobre Atenção", description: "Avalie a demanda de atenção no seu trabalho" },
  { id: "ergos_27", type: "radio", label: "27. A demanda perceptiva do trabalho (indicadores, alarmes) é?", required: true, options: ["Baixa", "Média", "Alta"] },
  { id: "ergos_28", type: "radio", label: "28. Manuseia máquinas perigosas?", required: true, options: ["Não", "Sim"] },
  { id: "ergos_29", type: "radio", label: "29. O trabalho requer precisão ou minuciosidade (movimentos finos)?", required: true, options: ["Pouco", "Média", "Alta"] },
  
  // Complexidade (3 questões)
  { id: "info_ergos_complexidade", type: "info", label: "Sobre Complexidade", description: "Avalie a complexidade das suas atividades" },
  { id: "ergos_30", type: "radio", label: "30. O trabalho requer uso frequente de manuais e documentos?", required: true, options: ["Não", "Sim"] },
  { id: "ergos_31", type: "radio", label: "31. O trabalho requer conhecimento técnico específico?", required: true, options: ["Pouco", "Médio", "Elevado"] },
  { id: "ergos_32", type: "radio", label: "32. Possíveis erros no seu trabalho podem gerar grandes repercussões?", required: true, options: ["Não", "Somente no processo", "Possíveis acidentes"] },
  
  // Monotonia (3 questões)
  { id: "info_ergos_monotonia", type: "info", label: "Sobre Monotonia", description: "Avalie a variação das suas atividades" },
  { id: "ergos_33", type: "radio", label: "33. Realiza em seu trabalho várias tarefas, funções, operações?", required: true, options: ["Não", "Sim"] },
  { id: "ergos_34", type: "radio", label: "34. Em trabalhos repetitivos, faz rodízio de atividades?", required: true, options: ["Não é repetitivo", "Sim", "Não"] },
  { id: "ergos_35", type: "radio", label: "35. Aparecem com frequência mudanças de operação no processo?", required: true, options: ["Sim", "Pouco", "Não"] },
  
  // Raciocínio e Processos Centrais (3 questões)
  { id: "info_ergos_raciocinio", type: "info", label: "Sobre Raciocínio e Processos Centrais", description: "Avalie a demanda cognitiva do seu trabalho" },
  { id: "ergos_36", type: "radio", label: "36. O trabalho exige raciocínio e solução de problemas?", required: true, options: ["Simples", "Médios", "Complexos"] },
  { id: "ergos_37", type: "radio", label: "37. Planeja ou programa as atividades de outras pessoas?", required: true, options: ["Não", "Sim"] },
  { id: "ergos_38", type: "radio", label: "38. Analisa e toma decisões sobre o processo de trabalho?", required: true, options: ["Não", "Sim"] },
  
  // Iniciativa (3 questões)
  { id: "info_ergos_iniciativa", type: "info", label: "Sobre Iniciativa", description: "Avalie sua autonomia no trabalho" },
  { id: "ergos_39", type: "radio", label: "39. Pode modificar livremente a ordem das operações que realiza?", required: true, options: ["Sim", "Parcialmente", "Não"] },
  { id: "ergos_40", type: "radio", label: "40. Pode resolver os incidentes do posto por iniciativa própria?", required: true, options: ["Sempre", "Às vezes", "Nunca"] },
  { id: "ergos_41", type: "radio", label: "41. Tem autonomia para planejar e executar o trabalho livremente?", required: true, options: ["Sim", "Parcialmente", "Não"] },
  
  // Isolamento (3 questões)
  { id: "info_ergos_isolamento", type: "info", label: "Sobre Isolamento", description: "Avalie o isolamento no seu trabalho" },
  { id: "ergos_42", type: "radio", label: "42. Está isolado fisicamente?", required: true, options: ["Sim", "Não"] },
  { id: "ergos_43", type: "radio", label: "43. Para desenvolver corretamente o trabalho é necessário se relacionar com colegas?", required: true, options: ["Sim", "Não"] },
  { id: "ergos_44", type: "radio", label: "44. Pode se comunicar falando (verbalmente) com os colegas?", required: true, options: ["Sim", "Com interfone ou rádio", "Não"] },
  
  // Horários e Turnos (2 questões)
  { id: "info_ergos_horarios", type: "info", label: "Sobre Horários e Turnos", description: "Avalie os horários de trabalho" },
  { id: "ergos_45", type: "radio", label: "45. Qual o tipo de horário de trabalho?", required: true, options: [
    "Comercial ou noturno fixo",
    "Turno único",
    "2 turnos alternados com folga sab-dom",
    "3 turnos alternados com folga sab-dom",
    "2 turnos alternados folga e domingo",
    "3 turnos alternados folga e domingo"
  ]},
  { id: "ergos_46", type: "radio", label: "46. Realiza horas extras com frequência?", required: true, options: ["Sim", "Não"] },
  
  // Relacionamentos (3 questões)
  { id: "info_ergos_relacionamentos", type: "info", label: "Sobre Relacionamentos", description: "Avalie os relacionamentos no trabalho" },
  { id: "ergos_47", type: "radio", label: "47. O trabalho é realizado em equipe?", required: true, options: ["Sim", "Às vezes", "Nunca"] },
  { id: "ergos_48", type: "radio", label: "48. Há relacionamentos com pessoas de outros setores ou terceiros?", required: true, options: ["Frequentemente", "Ocasionalmente", "Nunca"] },
  { id: "ergos_49", type: "radio", label: "49. O posto de trabalho requer muitos e variados termos de controle (burocracia)?", required: true, options: ["Sim", "Alguns", "Não"] },
  
  // Demandas Gerais (3 questões)
  { id: "info_ergos_demandas", type: "info", label: "Demandas Gerais", description: "Avalie outras demandas do seu trabalho" },
  { id: "ergos_50", type: "radio", label: "50. Deve supervisionar o trabalho de outras pessoas?", required: true, options: ["Sim", "Não"] },
  { id: "ergos_51", type: "radio", label: "51. Tem responsabilidades sobre outras pessoas e instalações?", required: true, options: ["Sim", "Só instalações", "Não"] },
  { id: "ergos_52", type: "radio", label: "52. Deve escrever e executar informativos técnicos, regras, etc?", required: true, options: ["Sim", "Às vezes", "Não"] },
];

// ========== TEMPLATES COMPLETOS ==========

// Template ADM: Administrativo (NASA-TLX + HSE-IT)
export const ADM_TEMPLATE: FormQuestion[] = [
  { id: "info_intro", type: "info", label: "Pesquisa de Avaliação do Trabalho - Administrativo", description: "Esta pesquisa avalia os principais fatores que influenciam seu bem-estar no ambiente de trabalho. Suas respostas são confidenciais e serão usadas apenas para fins de melhoria das condições de trabalho." },
  ...NASA_TLX_COMPARISONS,
  ...NASA_TLX_PERCEPTION,
  ...HSEIT_QUESTIONS,
  { id: "observacoes", type: "textarea", label: "Observações adicionais (opcional)", description: "Utilize este espaço para registrar qualquer observação adicional sobre seu ambiente de trabalho.", required: false },
];

// Template OP: Operacional (NASA-TLX + ERGOS)
export const OP_TEMPLATE: FormQuestion[] = [
  { id: "info_intro", type: "info", label: "Pesquisa de Avaliação do Trabalho - Operacional", description: "Esta pesquisa avalia os principais fatores que influenciam seu bem-estar no ambiente de trabalho. Suas respostas são confidenciais e serão usadas apenas para fins de melhoria das condições de trabalho." },
  ...NASA_TLX_COMPARISONS,
  ...NASA_TLX_PERCEPTION,
  ...ERGOS_QUESTIONS,
  { id: "observacoes", type: "textarea", label: "Observações adicionais (opcional)", description: "Utilize este espaço para registrar qualquer observação adicional sobre seu ambiente de trabalho.", required: false },
];

// Export individual sections for flexibility
export { NASA_TLX_COMPARISONS, NASA_TLX_PERCEPTION, HSEIT_QUESTIONS, ERGOS_QUESTIONS };
