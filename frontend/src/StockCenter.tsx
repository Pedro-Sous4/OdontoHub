import { useEffect, useState } from 'react';
import { api, setAuthToken } from './api';

interface StockItem {
  id: string;
  nome: string;
  quantidade: number;
  nivel_minimo: number;
  unidade: string;
}

interface StockCenterProps {
  token: string;
  onError: (message: string) => void;
}

const PRESET_ITEMS = [
  { nome: 'Agente de União - 4 ml', unidade: 'Cx.' },
  { nome: 'Agulha p/ Anestesia Curta 30 G', unidade: 'Cx.' },
  { nome: 'Agulha p/ Anestesia Longa', unidade: 'Cx.' },
  { nome: 'Água Destilada - litro', unidade: 'Litro' },
  { nome: 'Água Oxigenada - 10 volumes', unidade: 'Lt.' },
  { nome: 'Alcool 70 %', unidade: 'Lt.' },
  { nome: 'Álcool 70 % em gel', unidade: 'Fr.' },
  { nome: 'Algodão em Rolete', unidade: 'Pcte.' },
  { nome: 'Algodão 500 gr', unidade: 'Rolo' },
  { nome: 'Alveosan - 20 gr', unidade: 'Fr.' },
  { nome: 'Anestésico Inj. C/ V. Const. Citocaína 3 % 1.8 ml', unidade: 'Cx.' },
  { nome: 'Anestésico Inj. S/ V. Const. Lidocaína 2%', unidade: 'Cx.' },
  { nome: 'Anestésico Tópico 12 gr', unidade: 'Tb.' },
  { nome: 'Aplicador Descartável tipo Microbush c/100unid.', unidade: 'Cx.' },
  { nome: 'APH Resina A2', unidade: 'Unid.' },
  { nome: 'APH Resina A3', unidade: 'Unid.' },
  { nome: 'APH Resina C2', unidade: 'Unid.' },
  { nome: 'Alveolótomo', unidade: 'Unid.' },
  { nome: 'Aplicador dycal', unidade: 'Unid.' },
  { nome: 'Brunidor 29', unidade: 'Unid.' },
  { nome: 'Brunidor 33', unidade: 'Unid.' },
  { nome: 'Bobina papel grau cirúrgico - 120 mm x 100 mt', unidade: 'Unid.' },
  { nome: 'Bicarbonato de sódio', unidade: 'Unid.' },
  { nome: 'Carbono Dental em Tiras-4 micra', unidade: 'Unid.' },
  { nome: 'Cabo p/ Espelho bucal nº 5', unidade: 'Unid.' },
  { nome: 'Compressa de Gase Estéril - 7.5 x 7.5cm - pcte c/ 5 unid.', unidade: 'Pcte' },
  { nome: 'Cápsula p/ Amálgama c/ 1 porção', unidade: 'Unid.' },
  { nome: 'Cunha de madeira', unidade: 'Unid.' },
  { nome: 'Creme Dental', unidade: 'Tubo' },
  { nome: 'Cariostatic solução 10 ml', unidade: 'Fr.' },
  { nome: 'Cimento Hidróxido de Cálcio Lafe ou Hydro C', unidade: 'Cx.' },
  { nome: 'Compressa de Gase c/ 500 unid. 7.5 x 7.5 - não estéril', unidade: 'Pcte' },
  { nome: 'Cond. Dental Gel ( Ataque Ácido ) seringa 2.5 ml', unidade: 'unid.' },
  { nome: 'Cotonete - mais ou menos 75 unid.', unidade: 'Cx.' },
  { nome: 'Cureta cirurgica 5-6', unidade: 'Unid.' },
  { nome: 'Cureta cirurgica 7-8', unidade: 'Unid.' },
  { nome: 'Escova Dental infantil', unidade: 'Unid.' },
  // Page 2
  { nome: 'Escova Dental adulto', unidade: 'Unid.' },
  { nome: 'Escova de Robsom p/ Profilaxia', unidade: 'Unid.' },
  { nome: 'Espelho Bucal sem cabo nº 5', unidade: 'Unid.' },
  { nome: 'Escavador de dentina nº 14', unidade: 'Unid.' },
  { nome: 'Escavador de dentina nº 11 - 12', unidade: 'Unid.' },
  { nome: 'Espátula nº 24', unidade: 'Unid.' },
  { nome: 'Escultor Hollemback', unidade: 'Unid.' },
  { nome: 'Eugenol Líquido 20 ml', unidade: 'Fr.' },
  { nome: 'Fita p/ autoclave 19 mm x 30 mt.', unidade: 'Rolo' },
  { nome: 'Face Shield', unidade: 'Unid.' },
  { nome: 'Fio de Seda 4-0 c/ 24 envelopes', unidade: 'Cx.' },
  { nome: 'Fio Dental - aprox. 100 mt', unidade: 'Rolo' },
  { nome: 'Fluor Gel 1 minuto - aprox. 200 ml', unidade: 'Fr.' },
  { nome: 'Fluoreto de sodio 0,2% - 500 ml', unidade: 'Fr.' },
  { nome: 'Formocresol 10 ml', unidade: 'Fr.' },
  { nome: 'Guardanapo de papel 30 x 32 cm', unidade: 'pt' },
  { nome: 'Hemostático Esponja tipo Fibrinol', unidade: 'Unid.' },
  { nome: 'Hidróxido de Cálcio P.A - 10 GR', unidade: 'Fr.' },
  { nome: 'I.R.M. Pó - aprox. 38 gr', unidade: 'Fr.' },
  { nome: 'I.R.M Líquido - aprox. 15 ml', unidade: 'Fr.' },
  { nome: 'Ionômero de Vidro p/ restauração Cor U -Pó10 gr', unidade: 'Cx.' },
  { nome: 'Ionômero de Vidro R. líquido - 8 ml', unidade: 'Fr.' },
  { nome: 'Indicador biológico', unidade: 'Unid.' },
  { nome: 'Jaleco Descart. Poliet. Manga Longa c/ Botão - G', unidade: 'Unid.' },
  { nome: 'Luva p/ Proced. Tamanho P', unidade: 'Cx.' },
  { nome: 'Luva p/ Proced. Tamanho M.', unidade: 'Cx.' },
  { nome: 'Luva p/ Proced. Tamanho G.', unidade: 'Cx.' },
  { nome: 'Luva p/ Proced. Tamanho PP.', unidade: 'Cx.' },
  { nome: 'Máscara Descartável Dupla c/ elástico', unidade: 'Unid.' },
  { nome: 'Máscara PFF2', unidade: 'Unid.' },
  { nome: 'Mepivacaína', unidade: 'Cx.' },
  { nome: 'Matriz de aço - 5mm', unidade: 'Unid.' },
  { nome: 'Matriz de aço - 7 mm', unidade: 'Unid.' },
  { nome: 'Moldeira p/ Aplicação de Fluor - tamanho P', unidade: 'Unid.' },
  { nome: 'Moldeira p/ Aplicação de fluor - tamanho M', unidade: 'Unid.' },
  { nome: 'Moldeira p/ Aplicação de Fluor - tamanho G', unidade: 'Unid.' },
  { nome: 'Óculos de Proteção p/ Odonto', unidade: 'Unid.' },
  { nome: 'Óleo Vegetal lubrificante p/ Caneta- aprox. 100 ml', unidade: 'Fr.' },
  { nome: 'Óxido de Zinco Puro - 50 gr', unidade: 'Fr.' },
  { nome: 'Otosporin', unidade: 'Unid.' },
  { nome: 'Papel toalha', unidade: 'Fd.' },
  { nome: 'Paramonoclorofenol - 20 ml', unidade: 'Fr.' },
  { nome: 'Pasta Profilática -50 gr', unidade: 'Tb.' },
  // Page 3
  { nome: 'Placa de vidro fina', unidade: 'unid.' },
  { nome: 'Placa de vidro média', unidade: 'Unid.' },
  { nome: 'Pontas p/Sugador Descartável - c/ 40 unid', unidade: 'Pcte.' },
  { nome: 'Porta Amálgama de Metal', unidade: 'Unid.' },
  { nome: 'Porta Matriz', unidade: 'Unid.' },
  { nome: 'Pote de Dappen - médio de vidro', unidade: 'Unid.' },
  { nome: 'Prendedor de Guardanapo', unidade: 'Unid.' },
  { nome: 'Sabonete Líquido p/ mãos - c/ 5 lt', unidade: 'Gl.' },
  { nome: 'Seringa Carpule', unidade: 'Unid.' },
  { nome: 'Selante', unidade: 'Unid.' },
  { nome: 'Saca broca', unidade: 'Unid.' },
  { nome: 'Sindesmótomo', unidade: 'Unid.' },
  { nome: 'Sonda exploradora nº 05', unidade: 'Unid.' },
  { nome: 'Taça de borracha média p/ Profilaxia', unidade: 'Unid.' },
  { nome: 'Tira de Poliester 10x120x0,05 mm - 50 unid.', unidade: 'Pcte' },
  { nome: 'Tira de Lixa c/ 150 unid.', unidade: 'Pcte' },
  { nome: 'Tira de Aço 4 mm c/ 150', unidade: 'Pcte' },
  { nome: 'Tesoura iris reta', unidade: 'Unid.' },
  { nome: 'Touca descartável c/ elástico', unidade: 'Unid.' },
  { nome: 'Verniz Cavitário 10 ml', unidade: 'Fc.' },
  { nome: 'Broca Diamantada Esférica 1011', unidade: 'Unid.' },
  { nome: 'Broca Diamantada Esférica 1013', unidade: 'Unid.' },
  { nome: 'Broca Diamantada Esférica 1014', unidade: 'Unid.' },
  { nome: 'Broca Diamantada Esférica 1015', unidade: 'Unid.' },
  { nome: 'Broca Diamantada Esférica 1016', unidade: 'Unid.' },
  { nome: 'Broca Cônica Invertida 1031', unidade: 'Unid.' },
  { nome: 'Broca Cônica Invertida 1032', unidade: 'Unid.' },
  { nome: 'Broca Cônica Invertida 1033', unidade: 'Unid.' },
  { nome: 'Broca Cônica Invertida 1034', unidade: 'Unid.' },
  { nome: 'Broca Cônica Invertida 1035', unidade: 'Unid.' },
  { nome: 'Broca Cônica Invertida 1047', unidade: 'Unid.' },
  { nome: 'Broca Cônica Chama 1190', unidade: 'Unid.' },
  { nome: 'Broca Cilindrica Plana 1090', unidade: 'Unid.' },
  { nome: 'Broca Cilindrica Plana 1091', unidade: 'Unid.' },
  { nome: 'Broca Cilindrica Plana 1092', unidade: 'Unid.' },
  { nome: 'Broca Cilindrica Plana 1093', unidade: 'Unid.' },
  { nome: 'Broca Cilindrica Plana 1094', unidade: 'Unid.' },
  { nome: 'Broca Cilindrica Plana 1095', unidade: 'Unid.' },
  { nome: 'Broca Grana Gossa 4138 G', unidade: 'Unid.' },
  // Page 4
  { nome: 'Broca Acabamento fino 1112', unidade: 'Unid.' },
  { nome: 'Broca Acabamento fino 3118', unidade: 'Unid.' },
  { nome: 'Broca Acabamento fino 3195', unidade: 'Unid.' },
  { nome: 'Broca Acabamento fino 2135', unidade: 'Unid.' },
  { nome: 'Broca Cirurgica Longa FG 702 L', unidade: 'Unid.' },
  { nome: 'Broca 703', unidade: 'Unid.' },
  { nome: 'Broca de Aço Esférica 33 1/2 Esférica', unidade: 'Unid.' },
  { nome: 'Broca de Aço Esférica 1/2 Esférica', unidade: 'Unid.' },
  { nome: 'Broca p/ Contra ângulo Esférica 3', unidade: 'Unid.' },
  { nome: 'Broca p/ Contra ângulo Esférica 4', unidade: 'Unid.' },
  { nome: 'Broca p/ Contra ângulo Esférica 6', unidade: 'Unid.' },
  // Page 5
  { nome: 'Abaixador de Língua - pcte c/ 100', unidade: 'Pcte.' },
  { nome: 'Água Boricada - litro', unidade: 'Lt.' },
  { nome: 'Água Destilada - litro', unidade: 'Lt.' },
  { nome: 'Água Oxigenada', unidade: 'Lt.' },
  { nome: 'Álcool 70 % - litro', unidade: 'Lt.' },
  { nome: 'Agulha Descartável 13 x 4.5 - cx. C/ 100', unidade: 'Cx.' },
  { nome: 'Agulha Descartável 25 x 7 - cx c/ 100', unidade: 'Cx.' },
  { nome: 'Agulha Descartável 25 x 8 - cx c/ 100', unidade: 'Cx.' },
  { nome: 'Agulha Descartável 30 x 7 - cx c/ 100', unidade: 'Cx.' },
  { nome: 'Almotolia 250 ml', unidade: 'Unid.' },
  { nome: 'Algodão hidrófilo - 500 gr', unidade: 'Rl.' },
  { nome: 'Atadura de crepe 06x4,5 mt-emb.Individual-13 Fios', unidade: 'Dz.' },
  { nome: 'Atadura de crepe 10x4,5 mt-emb.Individual-14 Fios', unidade: 'Dz.' },
  { nome: 'Atadura de crepe 15x4,5 mt-emb.Individual-13 Fios', unidade: 'Dz.' },
  { nome: 'Atadura de crepe 20x4,5 mt-emb.Individual-13 Fios', unidade: 'Dz.' },
  { nome: 'Bisturi Descartável c/ cabo nº 10', unidade: 'Unid.' },
  { nome: 'Bisturi Descartável c/ cabo nº 15', unidade: 'Unid.' },
  { nome: 'Cabo de Bisturi nº 3', unidade: 'Unid.' },
  { nome: 'Compressa de Gase 7,5 x 7,5 cm-9 fios cm2-5dobras', unidade: 'Pcte c/ 500' },
  { nome: 'Esparadrapo 10 mt x 4,5 cm - rolo', unidade: 'Rl.' },
  { nome: 'Equipo Macrogotas', unidade: 'Unid.' },
  { nome: 'Escova p/ Assepsia das mãos', unidade: 'Unid.' },
  { nome: 'Espátula de Ayres', unidade: 'Pcte' },
  { nome: 'Escova p/coleta mat.citológico estéril-embal.individual', unidade: 'unid.' },
  { nome: 'Fita Adesiva Hospitalar 19 x 50', unidade: 'Rl.' },
  { nome: 'Fita Micropore2,5 x 10 mts branca', unidade: 'Rl.' },
  { nome: 'Fita p/ Autoclave 19 x 30 mts', unidade: 'Rl.' },
  { nome: 'Gel p/ Ultrassonografia - gl c/ 5 lt', unidade: 'Gl.' },
  { nome: 'Glutaraldeído 2 % - 14 dias - galão c/ 5 litros', unidade: 'Gl.' },
  { nome: 'Glutaraldeído 2 % - 28 dias - litro', unidade: 'lt.' },
  { nome: 'Hipoclorito de sódio 1 % - c/ 5 lt.', unidade: 'Gl.' },
  { nome: 'Kit p/ inalação', unidade: 'cj.' },
  { nome: 'Lâmina p/ coleta mat.citológico-c/1extremidade fosca', unidade: 'cx c/ 50' },
  { nome: 'Lâmina p/ bisturi nº 11', unidade: 'Unid.' },
  { nome: 'Lâmina p/ bisturi nº 15', unidade: 'Unid.' },
  { nome: 'Lâmina p/ bisturi nº 21', unidade: 'Unid.' },
  { nome: 'Lâmina p/ bisturi nº 22', unidade: 'Unid.' },
  { nome: 'Lâmina p/ bisturi nº 23', unidade: 'Unid.' },
  // Page 6
  { nome: 'Luva Cirúrgica Estéril nº 7.0', unidade: 'Par' },
  { nome: 'Luva Cirúrgica Estéril nº 7.5', unidade: 'Par' },
  { nome: 'Luva Cirúrgica Estéril nº 8.0', unidade: 'Par' },
  { nome: 'Luva Cirúrgica Estéril nº 8.5', unidade: 'Par' },
  { nome: 'Luva Desc. Ginecológica-emb. Individual estéril c/ 100', unidade: 'Pcte.' },
  { nome: 'Luva p/ Procedimento - tamanho PP-cx c/ 100', unidade: 'Cx.' },
  { nome: 'Luva p/ Procedimento - tamanho P -cx c/ 100', unidade: 'Cx.' },
  { nome: 'Luva p/ Procedimento - tamanho M - cx c/ 100', unidade: 'Cx.' },
  { nome: 'Luva p/ Procedimento - tamanho G - cx c/ 100', unidade: 'Cx.' },
  { nome: 'Máscara descartável dupla c/ elástico', unidade: 'Unid.' },
  { nome: 'Papel Kraft c/ gramatura - 50 x 50 - rolo', unidade: 'Rl.' },
  { nome: 'Papel lençol 50 x 50 - pcte c/ 6 rolos-absorvível', unidade: 'Rl.' },
  { nome: 'Papel p/ ECG - 48 x 30 x16', unidade: 'Rl.' },
  { nome: 'Pasta Eletrolítica p/ ECG - 100 gr', unidade: 'Fr.' },
  { nome: 'Povidine Degermante-litro', unidade: 'Lt.' },
  { nome: 'Povidine Tópico - litro', unidade: 'Lt.' },
  { nome: 'Seringa Descartável 1 ml c/ agulha', unidade: 'Unid.' },
  { nome: 'Seringa Descartável 3 ml s/ agulha', unidade: 'Unid.' },
  { nome: 'Seringa Descartável 5 ml s/ agulha', unidade: 'Unid.' },
  { nome: 'Seringa Descartável 10 ml s/ agulha', unidade: 'Unid.' },
  { nome: 'Seringa Descartável 20 ml s/ agulha', unidade: 'Unid.' },
  { nome: 'Scalp Descartável nº 23', unidade: 'Unid.' },
  { nome: 'Scalp Descartável nº 25', unidade: 'Unid.' },
  { nome: 'Scalp Descartável nº 27', unidade: 'Unid.' },
  { nome: 'Termômetro Clínico', unidade: 'Unid.' },
  { nome: 'Tira Reagente p/ Teste de Glicemia', unidade: 'Unid.' },
  { nome: 'Vaselina Líquida - litro', unidade: 'Lt.' },
  // Page 7
  { nome: 'Almofada p/ Carimbo Azul', unidade: 'Unid.' },
  { nome: 'Almofada p/ Carimbo Preta', unidade: 'Unid.' },
  { nome: 'Almofada p/ Carimbo Vermelha', unidade: 'Unid.' },
  { nome: 'Bobina p/ Fax - 216 mm x 30 mt', unidade: 'Rl.' },
  { nome: 'Borracha p/ lápis', unidade: 'Unid.' },
  { nome: 'Caderno Brochura - aprox. 100 folhas', unidade: 'Unid.' },
  { nome: 'Caderno Capa Dura - aprox. 100 folhas', unidade: 'Unid.' },
  { nome: 'Caixa Arquivo Morto - papelão', unidade: 'Unid.' },
  { nome: 'Caixa Arquivo Morto - polionda', unidade: 'Unid.' },
  { nome: 'Caneta Esferográfica Azul', unidade: 'Unid.' },
  { nome: 'Caneta Esferográfica Preta', unidade: 'Unid.' },
  { nome: 'Caneta Esferográfica Vermelha', unidade: 'Unid.' },
  { nome: 'Carbono Azul', unidade: 'Fl.' },
  { nome: 'Cartolina - várias cores', unidade: 'Unid.' },
  { nome: 'Clips 3-0', unidade: 'Cx.' },
  { nome: 'Corretor Líquido', unidade: 'Frs.' },
  { nome: 'Cola c/ 90 ml branca', unidade: 'Tb.' },
  { nome: 'Destaca Texto', unidade: 'Unid.' },
  { nome: 'Elástico p/ dinheiro nº 18', unidade: 'Pcte.' },
  { nome: 'Fita adesiva durex - 12 mm x 30', unidade: 'Rl.' },
  { nome: 'Fita p/ Impressora LX 300 - 80 colunas', unidade: 'Unid.' },
  { nome: 'Formulário Contínuo 80 colunas - 1 via', unidade: 'Cx.' },
  { nome: 'Grampo p/ grampeador 26/6', unidade: 'Cx.' },
  { nome: 'Lápis Preto nº 2', unidade: 'Unid.' },
  { nome: 'Livro Ata - aprox. 100 folhas', unidade: 'Unid.' },
  { nome: 'Papel Manilha 40 cm', unidade: 'Rl.' },
  { nome: 'Papel Sulfite 215 x 315', unidade: 'Rm.' },
  { nome: 'Pasta A Z', unidade: 'Unid.' },
  { nome: 'Pasta com elástico', unidade: 'Unid.' },
  { nome: 'Pasta com Grampo', unidade: 'Unid.' },
  { nome: 'Pasta Polionda - 3.5 cm de dorso', unidade: 'Unid.' },
  { nome: 'Pincel atômico azul', unidade: 'Unid.' },
  { nome: 'Pincel atômico preto', unidade: 'Unid.' },
  { nome: 'Pincel atômico vermelho', unidade: 'Unid.' },
  { nome: 'Régua Plástica Cristal 30 cm', unidade: 'Unid.' },
  { nome: 'Tinta p/ Almofada azul', unidade: 'Fr.' },
  { nome: 'Tinta p/ Almofada preta', unidade: 'Fr.' },
  { nome: 'Tinta p/ Almofada vermelha', unidade: 'Fr.' },
  { nome: 'Tinta p/ Pincel azul', unidade: 'Fr.' },
  { nome: 'Tinta p/ Pincel preta', unidade: 'Fr.' },
  { nome: 'Tinta p/ Pincel vermelha', unidade: 'Fr.' },
  // Page 8
  { nome: 'Açúcar Cristal', unidade: 'Kg' },
  { nome: 'Balde Plástico - 20 litros', unidade: 'Unid.' },
  { nome: 'Café Torrado e Moído', unidade: 'Kg' },
  { nome: 'Coador de Papel nº 103 c/ 40', unidade: 'Cx.' },
  { nome: 'Detergente Neutro c/ 5 lts', unidade: 'Gl.' },
  { nome: 'Esponja de aço - tipo Bombril c/ 8', unidade: 'Pcte' },
  { nome: 'Esponja dupla face - tipo Scotch Brite', unidade: 'Unid.' },
  { nome: 'Flanela p/ limpeza - 48 x 30', unidade: 'Unid.' },
  { nome: 'Fósforo - c/ 10', unidade: 'Pcte' },
  { nome: 'Luva de látex tamanho M', unidade: 'Par' },
  { nome: 'Luva de látex tamanho G', unidade: 'Par' },
  { nome: 'Pano de chão tipo esfregão', unidade: 'Unid.' },
  { nome: 'Pano p/ limpeza - tipo Perfex c/ 5 unidades', unidade: 'Pcte' },
  { nome: 'Papel Higiênico', unidade: 'Rl.' },
  { nome: 'Papel toalha interfolha - 2 dobras', unidade: 'Fd.' },
  { nome: 'Pá p/ lixo c/ cabo longo', unidade: 'Unid.' },
  { nome: 'Pilha Pequena', unidade: 'Unid.' },
  { nome: 'Pilha Média', unidade: 'Unid.' },
  { nome: 'Pilha Palito', unidade: 'Unid.' },
  { nome: 'Pincel p/ vaso sanitário', unidade: 'Unid.' },
  { nome: 'Rodo de madeira c/ cabo - 40 cm', unidade: 'Unid.' },
  { nome: 'Sabão em Pedra - barra', unidade: 'Unid.' },
  { nome: 'Sabão em Pó - cx c/ 1 kg', unidade: 'Cx.' },
  { nome: 'Sabonete Líquido p/ limpeza das mãos - 5 lts', unidade: 'Gl.' },
  { nome: 'Saco p/lixo branco Leitoso 40 lt', unidade: 'Kg' },
  { nome: 'Saco p/ lixo preto - 20 litros', unidade: 'Kg' },
  { nome: 'Saco p/ lixo preto - 40 litros', unidade: 'Kg' },
  { nome: 'Saco p/ lixo preto - 100 litros', unidade: 'Kg' },
  { nome: 'Vassoura de nylon c/ cabo - tipo Noviça', unidade: 'Unid.' },
  { nome: 'Vassoura de Pêlo', unidade: 'Unid.' },
  // Materiais Complementares do Catálogo Odontológico
  { nome: 'Alginato - pacote 500g', unidade: 'Pcte.' },
  { nome: 'Silicone de Condensação - kit', unidade: 'Kit' },
  { nome: 'Cimento Endodôntico - pó+líquido', unidade: 'Kit' },
  { nome: 'Cones de Guta-percha', unidade: 'Cx.' },
  { nome: 'Limas Endodônticas K-File - 25mm', unidade: 'Cx.' },
  { nome: 'Brackets Ortodônticos Metálicos - kit', unidade: 'Kit' },
  { nome: 'Arco Ortodôntico Nitinol', unidade: 'Unid.' },
  { nome: 'Banda Ortodôntica', unidade: 'Unid.' },
  { nome: 'Resina Composta Z250 XT - seringa 4g', unidade: 'Seringa' },
  { nome: 'Adesivo Single Bond Universal - 5ml', unidade: 'Fr.' },
  { nome: 'Ácido Fosfórico Condac 37% - seringa 3g', unidade: 'Seringa' },
  { nome: 'Clorexidina 2% Gel - seringa 2g', unidade: 'Seringa' },
  { nome: 'Fórceps Odontológico nº 18R', unidade: 'Unid.' },
  { nome: 'Alavanca Seldin Curva nº 1L', unidade: 'Unid.' },
  { nome: 'Cimento Resinoso Dual Allcem', unidade: 'Kit' },
  { nome: 'Papel Articulador de Carbono - tira', unidade: 'Pcte.' },
  { nome: 'Placa de Mordida Miorrelaxante', unidade: 'Unid.' },
  { nome: 'Gesso Pedra Tipo IV', unidade: 'Kg' }
];

export function StockCenter({ token, onError }: StockCenterProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  
  const [form, setForm] = useState({
    nome: '',
    quantidade: 0,
    nivel_minimo: 0,
    unidade: 'un'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (token) {
      loadItems();
    }
  }, [token]);

  async function loadItems() {
    try {
      setLoading(true);
      setAuthToken(token);
      const response = await api.get<StockItem[]>('/stock');
      setItems(response.data);
    } catch {
      onError('Erro ao carregar itens do estoque.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setAuthToken(token);
      if (editingItem) {
        await api.put(`/stock/${editingItem.id}`, form);
      } else {
        await api.post('/stock', form);
      }
      setShowModal(false);
      setEditingItem(null);
      setForm({ nome: '', quantidade: 0, nivel_minimo: 0, unidade: 'un' });
      setSearchTerm('');
      setShowDropdown(false);
      loadItems();
    } catch {
      onError('Erro ao salvar item.');
    }
  }

  function openEdit(item: StockItem) {
    setEditingItem(item);
    setForm({
      nome: item.nome,
      quantidade: item.quantidade,
      nivel_minimo: item.nivel_minimo,
      unidade: item.unidade
    });
    setSearchTerm(item.nome);
    setShowDropdown(false);
    setShowModal(true);
  }

  async function deleteItem(id: string) {
    if (!window.confirm('Tem certeza que deseja excluir este item?')) return;
    try {
      setAuthToken(token);
      await api.delete(`/stock/${id}`);
      loadItems();
    } catch {
      onError('Erro ao excluir item.');
    }
  }

  // Filter preset items based on user search
  const filteredPresetItems = PRESET_ITEMS.filter((item) =>
    item.nome.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10); // Limit to top 10 matches for better UX

  return (
    <div className="patientsPanel" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <header className="patientsHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.5px' }}>Controle de Estoque</h2>
        <button 
          type="button" 
          style={{ 
            padding: '10px 18px', 
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: '600', 
            fontSize: '13px',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -2px rgba(37, 99, 235, 0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease-in-out'
          }} 
          onClick={() => { 
            setEditingItem(null); 
            setForm({ nome: '', quantidade: 0, nivel_minimo: 0, unidade: 'un' }); 
            setSearchTerm('');
            setShowDropdown(false);
            setShowModal(true); 
          }}
        >
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>+</span> Adicionar Item
        </button>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Carregando...</div>
      ) : (
        <div className="tableWrapper" style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Item</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Quantidade</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Nível Mínimo</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isLow = item.quantidade <= item.nivel_minimo;
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#0f172a' }}>{item.nome}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#0f172a' }}>{item.quantidade} {item.unidade}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{item.nivel_minimo} {item.unidade}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {isLow ? (
                        <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '500' }}>Baixo</span>
                      ) : (
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '500' }}>Normal</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', marginRight: '10px', fontSize: '14px' }} onClick={() => openEdit(item)}>Editar</button>
                      <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }} onClick={() => deleteItem(item.id)}>Excluir</button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '14px' }}>Nenhum item no estoque.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="scheduleModalOverlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(false)}>
          <div className="scheduleModal" style={{ maxWidth: '400px', padding: '20px', background: '#fff', borderRadius: '12px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="scheduleModalHeader" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{editingItem ? 'Editar Item' : 'Adicionar Item'}</strong>
              <button type="button" className="popoverClose" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>Nome</label>
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <input 
                  type="text" 
                  value={form.nome} 
                  onChange={e => {
                    const val = e.target.value;
                    setForm({ ...form, nome: val });
                    setSearchTerm(val);
                    setShowDropdown(true);
                  }} 
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Digite para buscar ou adicionar item..."
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                  required 
                />
                
                {showDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1100,
                    marginTop: '4px'
                  }}>
                    {filteredPresetItems.map((item, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          setForm({ ...form, nome: item.nome, unidade: item.unidade });
                          setSearchTerm(item.nome);
                          setShowDropdown(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#0f172a',
                          borderBottom: '1px solid #f1f5f9',
                          background: '#fff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                      >
                        <span>{item.nome}</span>
                        <span style={{ fontSize: '11px', color: '#475569', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>{item.unidade}</span>
                      </div>
                    ))}
                    
                    {searchTerm.trim() && !PRESET_ITEMS.some(item => item.nome.toLowerCase() === searchTerm.toLowerCase()) && (
                      <div
                        onClick={() => {
                          setForm({ ...form, nome: searchTerm });
                          setShowDropdown(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#2563eb',
                          fontWeight: '600',
                          background: '#f8fafc',
                          borderTop: filteredPresetItems.length > 0 ? '1px solid #e2e8f0' : 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#e0f2fe'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
                      >
                        + Usar item personalizado: "{searchTerm}"
                      </div>
                    )}
                    
                    {filteredPresetItems.length === 0 && !searchTerm.trim() && (
                      <div style={{ padding: '12px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                        Digite para buscar itens...
                      </div>
                    )}
                  </div>
                )}
              </div>

              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>Quantidade</label>
              <input type="number" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} required />

              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>Nível Mínimo</label>
              <input type="number" value={form.nivel_minimo} onChange={e => setForm({ ...form, nivel_minimo: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} required />

              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64748b' }}>Unidade</label>
              <input type="text" value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px', boxSizing: 'border-box' }} placeholder="Ex: un, cx, kg" required />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
