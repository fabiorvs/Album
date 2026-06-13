# Meu Álbum 2026

Aplicativo mobile-first para controlar as 994 figurinhas listadas em `controle.pdf`.

## Recursos

- Progresso geral, por grupo e por seleção
- Cadastro rápido pelo código da figurinha
- Leitura do código impresso usando a câmera e OCR no próprio aparelho
- Controle de figurinhas faltantes e repetidas
- Busca por país ou código
- Compartilhamento das listas de faltantes e repetidas
- Backup e restauração em JSON
- Tema claro/escuro
- Instalação como aplicativo no Android e funcionamento offline

Os dados ficam salvos somente no navegador do aparelho. Exporte backups periodicamente pela tela **Ajustes**.

## Uso

Para testar localmente:

```bash
python3 -m http.server 8080
```

Depois, abra `http://localhost:8080`.

Para instalar no Android, publique os arquivos deste diretório em uma hospedagem HTTPS, abra o endereço no Chrome e use **Adicionar à tela inicial** ou **Instalar app**.

No álbum, toque em uma figurinha para adicioná-la ou registrar outra unidade. Toque e segure para remover uma unidade.
