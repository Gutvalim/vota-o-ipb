

## Problema Identificado

O projeto não compila porque os contextos `AuthContext.tsx` e `ElectionContext.tsx` importam o Firebase (`firebase/app` e `firebase/firestore`), mas o pacote **não está instalado** nas dependências do `package.json`.

## Solução

Adicionar o pacote `firebase` como dependência do projeto. Isso resolverá os 4 erros de build:

- `Cannot find module 'firebase/app'`
- `Cannot find module 'firebase/firestore'`

Basta instalar o pacote `firebase` — nenhuma alteração de código é necessária.

