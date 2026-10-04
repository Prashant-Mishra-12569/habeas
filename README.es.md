<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/habeas-mark-carbon.png">
  <img src="apps/web/public/brand/habeas-mark.png" alt="Logo de Habeas" width="96">
</picture>

# Habeas

[English](README.md)

**Un proceso justo antes de que te quiten tus tokens.** En vivo: https://habeas-stellar.vercel.app

Los bancos y fondos que emiten tokens en Stellar pueden congelarlos o recuperarlos (clawback). A veces hace falta: hay fraudes y hay errores. Pero hoy puede pasar sin dar una razón y sin forma de responder. El 19 de septiembre de 2026, el emisor de la stablecoin piloto de U.S. Bank envió 24.000 tokens y los recuperó 15 minutos después. El registro público muestra el hecho, pero ninguna razón y ningún proceso ([las operaciones](docs/EVIDENCE.md#the-real-world-event-habeas-responds-to-mainnet)).

Habeas es un contrato de Soroban que se convierte en el administrador de un token, así que congelar y recuperar solo puede pasar mediante un **caso**:

1. El emisor abre un caso con una razón pública y la huella del archivo que la respalda. El titular queda congelado.
2. El titular puede responder antes de un plazo. Responder es gratis: Habeas paga la comisión de red.
3. Un revisor neutral decide.
4. Cualquiera puede cerrar el caso: **Liberado** (se descongela) o **Recuperado**.

Si el titular nunca responde, los tokens se pueden recuperar después del plazo. **Si el revisor nunca decide, el titular gana por defecto.** Las emergencias (una orden judicial, un robo en curso) necesitan al emisor *y* al revisor, y aun así quedan registradas con una razón.

Hecho para el [Find Your Way Hackathon](https://demo.stellarpassport.xyz/hackathons/find-your-way-meridian-hackathon) de Tellus Cooperative.

## Estado

Funciona en Stellar **testnet**. Sitio: **https://habeas-stellar.vercel.app** (inglés y español, tema claro "Papel" y oscuro "Carbón").

- **Contrato:** [`contracts/habeas`](contracts/habeas), 54 pruebas contra el Stellar Asset Contract real, desplegado desde una [compilación verificada en GitHub](docs/EVIDENCE.md#check-the-build-yourself).
- **Cada final de un caso** se corrió en testnet, con enlaces a las transacciones: [`docs/EVIDENCE.md`](docs/EVIDENCE.md) y [/evidence](https://habeas-stellar.vercel.app/evidence).
- **Respuesta gratis, probada con una billetera real:** en Freighter el titular firma solo la autorización y Habeas paga la comisión ([caso 8](https://habeas-stellar.vercel.app/case/8)).
- **Revisión de tokens con datos reales de mainnet:** [USBDCP](https://habeas-stellar.vercel.app/check/USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E), USDC, PYUSD y BENJI, además del token de demo protegido.
- **Funciona en teléfonos y es accesible:** cada página se prueba a 320, 390, 768 y 1440 px en CI (Playwright) y contra WCAG 2.x AA con axe en ambos temas e idiomas; accesibilidad en Lighthouse: 100.
- Cómo funcionan los casos, funciones, errores y eventos: [`docs/SPEC-cases.md`](docs/SPEC-cases.md) (en inglés).
- **Pruébalo en vivo**, con o sin billetera (también en el teléfono): quedas congelado, respondes gratis, el revisor decide y se cierra el caso; luego el otro final, donde el silencio significa que se recuperan los tokens. Playwright lo corre en testnet.
- **Páginas de casos:** la historia de cada caso con sus transacciones, un botón gratuito para cerrarlo y páginas para titulares (`/me`), el emisor (`/issuer`) y el revisor (`/review`).
- **Revisión pagada para agentes (x402):** billeteras y agentes de IA pagan 0,001 USDC de testnet por llamada por una revisión firmada ([abajo](#revisión-pagada-para-agentes-x402)).
- **Alertas por Telegram (beta):** sigue una dirección y recibe un mensaje cuando la congelan, cuando hace falta una decisión y cuando se cierra el caso ([`apps/alerts`](apps/alerts)).

## Revisión pagada para agentes (x402)

Antes de aceptar un token, una billetera, una app de pagos o un agente de IA debería saber si el emisor puede congelarlo o recuperarlo, y si ya lo ha hecho. El sitio lo responde gratis. Las máquinas pueden preguntar `GET /api/v1/check/CODIGO-EMISOR?network=mainnet|testnet` y pagar 0,001 USDC por respuesta con [x402](https://www.x402.org) en Stellar testnet. La respuesta es el mismo JSON que usa la página de revisión, firmado con una clave ed25519 publicada en [`/api/v1/key`](https://habeas-stellar.vercel.app/api/v1/key), así quien compra puede guardarla y probar después qué dijo Habeas y cuándo.

```bash
cd examples && npm install
```

```bash
AGENT_SECRET=S... node agent-check.ts USBDCP-GDABKPZMAIULVJVJJQM7L3VIG5A2IS5V4KP2P3YNP6YWRUBJNBGFGG6E
```

[`examples/agent-check.ts`](examples/agent-check.ts) paga, comprueba la firma contra la clave fijada e imprime el veredicto. `AGENT_SECRET` es una cuenta de testnet con un poco de USDC de testnet (`scripts/setup-x402.mjs` crea una). El pago solo se cobra si llega una respuesta: un activo inválido o una caída de Stellar devuelven un error y no se cobra nada. Pagos en testnet: [`docs/EVIDENCE.md`](docs/EVIDENCE.md#paid-agent-check-x402) y la [página para desarrolladores](https://habeas-stellar.vercel.app/developers).

## Cerrar la puerta trasera

Hacer a Habeas administrador del token no basta por sí solo. La cuenta del emisor todavía puede congelar o recuperar con operaciones clásicas de Stellar, saltándose el contrato. Lo probamos en testnet ([S4](spikes/RESULTS.md#s4-the-classic-back-door)). Hay dos formas de cerrarla, y la revisión de tokens dice cuál usa cada activo:

- **El revisor firma también (lo que elegiría un banco real).** El revisor se agrega como firmante de la cuenta del emisor y se suben los umbrales, así el emisor no puede firmar solo un congelamiento o una recuperación. El banco conserva su cuenta para lo que necesite después, pero solo con el acuerdo del revisor.
- **La llave del emisor se desactiva (la demo).** Cuando termina la configuración clásica de la cuenta, el peso de su llave pasa a 0. Nadie puede volver a firmar por ella; emitir tokens sigue funcionando porque pasa por Habeas. Es lo más fácil de verificar, y no se puede deshacer.

## Revisor: una persona o un panel

La demo usa una sola llave de revisor. Al contrato no le importa qué tipo de dirección sea el revisor, así que un panel funciona sin cambios: una cuenta multifirma de Stellar o una smart account. La prueba [`two_of_three_members_can_decide`](contracts/habeas/src/test.rs) registra un panel de 2 de 3 como revisor y firma decisiones con llaves ed25519 reales: dos miembros pueden decidir; un miembro solo, alguien de fuera o el mismo miembro dos veces son rechazados.

## Córrelo tú

Necesitas Rust, la [Stellar CLI](https://developers.stellar.org/docs/tools/cli) (28.x) y Node 22.18 o más nuevo (se recomienda 24; el bot de alertas y el ejemplo de x402 corren TypeScript directamente).

```bash
cargo test
```

```bash
bash scripts/deploy-testnet.sh
```

```bash
cd scripts && npm install && cd .. && node scripts/run-demo-cases.mjs
```

```bash
cd apps/web && cp .env.example .env.local && npm install && npm run dev
```

El sitio necesita tres llaves de testnet en `apps/web/.env.local` para Pruébalo en vivo y una cuarta para firmar las revisiones pagadas (ver `.env.example`); las demás páginas solo leen datos públicos de Stellar.

El script de despliegue crea cuentas nuevas de testnet con Friendbot, emite un activo de demo, despliega Habeas, bloquea la cuenta del emisor y comprueba el bloqueo. El segundo script corre cada tipo de caso y guarda los hashes de las transacciones en `deployments/testnet-run.json`.

El bot de alertas por Telegram tiene su propia configuración (un token de @BotFather): [`apps/alerts/README.md`](apps/alerts/README.md) (en inglés).

## Lo que sigue

- Un panel de revisores (2 de 3) en la demo en vivo. El contrato ya lo permite (ver arriba); falta el flujo de firmas en el sitio.
- Redes de revisores independientes, para que el emisor no elija al revisor.
- Desplegar en mainnet cuando un emisor quiera usarlo.

## Lo que esto no hace

- No decide quién tiene la razón. Eso lo hace el revisor.
- El emisor elige al revisor. Las redes de revisores independientes están en lo que sigue.
- Mientras un caso está abierto, se congela todo el saldo del titular en ese token, no solo el monto en disputa. Así funciona el congelamiento en Stellar. Solo se puede recuperar hasta el monto del caso.
- Ningún emisor real lo usa todavía. Funciona en testnet.
- Los archivos quedan fuera de la cadena. Solo sus huellas (SHA-256) son públicas.

## Trabajo relacionado

[MintGate](https://github.com/SURUJ404/stellarcontracts) también pone un contrato a cargo de los poderes de administración de un token, con roles, límites de emisión y un congelamiento antes de incautar. Controla al personal del propio emisor; no tiene aviso al titular, respuesta, revisor ni descongelamiento por defecto. Habeas se ocupa del lado del titular.

## Licencia

MIT
