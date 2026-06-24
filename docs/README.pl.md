# Learn-it

> Potok nauki oparty na AI, który buduje trwałą wiedzę - powtórki rozłożone w czasie, aktywne przypominanie i wynik biegłości, którego nie da się sfałszować.

<!-- README-I18N:START -->

[English](../README.md) | [中文](./README.zh.md) | [Español](./README.es.md) | **Polski** | [日本語](./README.ja.md) | [Deutsch](./README.de.md)

<!-- README-I18N:END -->

Rozpoznanie to nie to samo co przypomnienie. Możesz rozpoznać odpowiedź, gdy ją widzisz, a mimo to nie potrafić wydobyć jej z pamięci bez podpowiedzi. Learn-it jest stworzony dla tego drugiego rodzaju wiedzy: generuje spersonalizowaną ścieżkę nauki, a następnie prowadzi cię przez sprawdzone metody z nauk kognitywnych - powtórki rozłożone w czasie (FSRS), aktywne przypominanie, technikę Feynmana, głębię taksonomii Blooma i drabinę umiejętności Dreyfusa - aż wiedza naprawdę osiądzie w pamięci długotrwałej.

Steruje nim AI poprzez umiejętność `/learn-it`. AI diagnozuje cię, uczy i ocenia; lekkie CLI w Bun jest silnikiem, który wywołuje, zapisując tylko to, co faktycznie wykażesz.

> [!NOTE]
> Biegłość jest **obliczana na podstawie zarejestrowanych wyników, nigdy deklarowana samodzielnie.** Oszukiwanie własnego wyniku to dokładnie ta iluzja kompetencji, którą to narzędzie ma pokonać - więc edycja pliku nie ruszy go z miejsca.

## Funkcje

- **Spersonalizowana mapa drogowa** - diagnoza ocenia to, co już umiesz, i rozbija temat na liście wielkości pojedynczego pojęcia, dzięki czemu pomijasz to, co opanowane, i nie dochodzi do przeciążenia poznawczego.
- **Powtórki rozłożone w czasie na poziomie pojęcia** - każde *pojęcie* (a nie każda fiszka) ma własny harmonogram FSRS, posuwany naprzód dowolnym sposobem, którym je wzmacniasz: ponownym wyjaśnieniem, quizem, ponowną lekturą lub fiszką.
- **Aktywne przypominanie wieloma drogami** - fiszki to jeden ze sposobów, a nie cel. Ponowne wyjaśnienie (Feynman), odpowiedź na celne pytanie z quizu czy wykonanie małego, prawdziwego zadania liczą się; bierne czytanie zalicza się jedynie jako rozpoznanie, nigdy jako dowód.
- **Surowa, niemożliwa do sfałszowania biegłość** - poziom Dreyfusa na temat (`novice → … → expert`), zagregowany z dopisywanego tylko dziennika ocenionych przypomnień i ocenianych według rubryki sprawdzianów. Ilość nigdy nie podnosi poziomu; `expert` wymaga prawdziwej budowy oraz trwałości w czasie.
- **Obserwator, nie tory** - faza jest *wnioskowana* z rzeczywistego stanu, nigdy nie przechowywana. Każdy etap uruchamia się na żądanie; jeśli wyprzedzasz tok, obserwator podpowiada i zostawia decyzję tobie.
- **Wiele tematów naraz** - prowadź Rust, sieci komputerowe i gotowanie równolegle; kolejka powtórek przeplata to, co przypada do powtórzenia, ze wszystkich tematów.
- **Lokalny pulpit webowy** - strona `Bun.serve` bez budowania pod `localhost:4321` do samodzielnych powtórek między sesjami.

## Wymagania wstępne

- [Bun](https://bun.sh) ≥ 1.3 - uruchamia cały silnik (CLI, pulpit, testy oraz wbudowane SQLite). Node.js nie jest wymagany.
- `git`.
- Agentowe CLI do sterowania nim - zalecane [Claude Code](https://claude.com/claude-code); umiejętność jest też przystosowana do [Qwen Code](https://github.com/QwenLM/qwen-code), [OpenCode](https://opencode.ai) i [Gemini CLI](https://github.com/google-gemini/gemini-cli).

## Instalacja

Jedna linia instaluje Bun w razie potrzeby, klonuje repozytorium, instaluje zależności i tworzy bazę danych.

**Linux / macOS**

```bash
curl -fsSL https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.sh | bash
```

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.ps1 | iex
```

<details>
<summary>Albo zainstaluj ręcznie</summary>

```bash
git clone https://github.com/fn-jakubkarp/learn-it.git
cd learn-it
bun install
bun src/init-db.ts          # create data/learn_it.db
bun run verify              # optional: biome + tsc + bun test
```

</details>

<details>
<summary>Instalacja bez telemetrii</summary>

Zapisz wyłączenie **przed pierwszym uruchomieniem** — Bun automatycznie wczytuje `.env`, więc każda komenda jest wyłączona od samego początku (bez powiadomienia przy pierwszym uruchomieniu, bez tworzenia jakiegokolwiek id). `.env` jest w gitignore.

**Linux / macOS**

```bash
git clone https://github.com/fn-jakubkarp/learn-it.git && cd learn-it
echo "LEARN_IT_TELEMETRY=0" > .env
bun install && bun src/init-db.ts
```

**Windows (PowerShell)**

```powershell
git clone https://github.com/fn-jakubkarp/learn-it.git; cd learn-it
"LEARN_IT_TELEMETRY=0" | Out-File -Encoding ascii .env
bun install; bun src/init-db.ts
```

Wolisz przełącznik dla całego systemu? `export DO_NOT_TRACK=1` wyłącza telemetrię w tym narzędziu i w każdym innym, które respektuje [ten standard](https://consoledonottrack.com).

</details>

## Użycie

Otwórz swoje agentowe CLI **wewnątrz repozytorium** - silnik działa z katalogiem głównym repozytorium jako katalogiem roboczym - i wywołaj umiejętność. Bez argumentu pokazuje pulpit ze wszystkimi tematami; argument wskazuje etap. Learn-it jest pomyślany tak, by sterowało nim AI, a nie wpisywanie go ręcznie - pętla jest konwersacyjna: diagnoza → rozmowa → planowanie → rozłożona w czasie ponowna ekspozycja → weryfikacja.

```
/learn-it                   # dashboard across all subjects + the command menu
/learn-it init rust         # start a subject (just your goal — no self-inventory)
/learn-it explore-gaps rust # the diagnostic: it tests you and places you, you don't self-report
/learn-it reinforce         # the daily loop: spaced, varied re-exposure of due concepts
```

### Etapy

Każdy etap uruchamia się na żądanie - nic nie jest zablokowane. `[subject]` jest opcjonalny (działa na wszystkie tematy, gdy pominięty); `{…}` jest wymagany.

**Diagnoza i planowanie**

| Etap | Co robi |
| --- | --- |
| `/learn-it` | Uruchamia pulpit, a następnie wypisuje stan i menu poleceń dla wszystkich tematów. |
| `init {subject} [slug]` | Tworzy szkielet tematu i zapisuje twój **cel** (dlaczego + meta). Nadaje krótki, ascii **slug** (np. `egzamin-krotkofalowca-klasa-1`) — stabilny, bezpieczny w cudzysłowie identyfikator, który przekazujesz do późniejszych poleceń (pełna nazwa też działa). Bez samooceny — poziom jest mierzony, nie deklarowany. |
| `explore-topic {subject}` | Mapuje **całe** terytorium na pojęcia i rejestruje je — pokrycie pochodzi z dziedziny, nie z twojej pamięci, więc nienazwane luki też trafiają na mapę. |
| `explore-gaps {subject}` | Sonduje jedno pojęcie naraz (reagujesz na podpowiedź, nie przypominasz swobodnie), uczy jednozdaniowej esencji przy każdej luce i wypisuje raport 🟢/🟡/🔴 o tym, gdzie naprawdę jesteś. Ustawia `target`. |
| `plan {subject}` | Uzgadnia mapę z wynikami sondowania; porządkuje ją od podstaw. |

**Nauka i zakotwiczanie**

| Etap | Co robi |
| --- | --- |
| `concept {term}` | Uczy przez analogię + mechanizm; ty przeformułowujesz to do `notes.md`. |
| `anchor {facts}` | Mnemotechniki tylko dla surowych faktów (składnia, nazwy, daty). |
| `extract {subject}` | Zamienia twoje notatki w fiszki. |

**Przypominanie i rozkładanie w czasie**

| Etap | Co robi |
| --- | --- |
| `reinforce [subject]` | **Codzienna pętla** - rozłożona w czasie, urozmaicona ponowna ekspozycja pojęć przypadających do powtórzenia, najsłabsze najpierw. |
| `review [subject]` | Przypominanie z fiszek, oceniane, z informacją zwrotną przy pomyłce. |
| `quiz {subject} {concept}` | Jedno celne pytanie na przypomnienie/zastosowanie. |

**Weryfikacja i ocena**

| Etap | Co robi |
| --- | --- |
| `feynman {subject}` | Ty tłumaczysz to z powrotem; AI sonduje luki → zapisuje dowód `explain`. |
| `exam {subject}` | Trudny sprawdzian na *nowym* problemie → zapisuje dowód `apply`. |
| `assess {subject} [kind]` | Wydaje ustrukturyzowane zadanie domowe (`explain`/`apply`/`build`) wymierzone w twój słaby punkt. |
| `evaluate {subject} {kind} {0-100} [file]` | Ocenia zgłoszenie według stałej rubryki (≥ 70 zalicza) i zamyka zadanie. |
| `mastery {subject}` | Bieżący poziom, % do następnego i co dokładnie go blokuje. |

> [!NOTE]
> `build` to rodzaj-kamień milowy: mały, lecz prawdziwy wytwór, przepytywany przed oceną. Zaliczony `build` to jedyna droga do dowodu wymaganego przez ocenę `expert`.

Do samodzielnych powtórek między sesjami lokalny pulpit nie potrzebuje AI:

```bash
bun src/dashboard.ts        # → http://localhost:4321
```

> [!TIP]
> Aby `/learn-it` było wykrywalne z dowolnego projektu, zainstaluj je jako wtyczkę Claude Code: `/plugin marketplace add fn-jakubkarp/learn-it`, a następnie `/plugin install learn-it@learn-it`. Silnik nadal działa ze sklonowanego repozytorium, więc zachowaj klon.

> [!IMPORTANT]
> Surowe wywołania `bun src/learn-it.ts <cmd>` to silnik, którym steruje umiejętność, a nie ręczny przepływ pracy. Sięgaj po nie bezpośrednio tylko po to, by przejrzeć lub skryptowo przetworzyć swoje dane (`export`, `doctor`, `db`).

## Jak to działa

**Dwa poziomy.** *Temat (subject)* to rzecz, którą opanowujesz (np. „Rust”), i nosi mapę drogową, fazę oraz poziom Dreyfusa. *Pojęcie (concept)* to liść wielkości lekcji pod nim (np. „ownership”); fiszki podpinają się tutaj. Mapa drogowa to lista pojęć, a biegłość agreguje się z niej - nie możesz być „ekspertem” w pojedynczym fakcie.

**Fazy to mapa, nie tory kolejowe.** Learn-it odczytuje twój rzeczywisty stan (pojęcia zmapowane? *sprawdzone*? fiszki powtórzone?), by wywnioskować, gdzie znajduje się każdy temat — diagnose zostaje za tobą, gdy zostałeś przetestowany, nigdy gdy wypełniłeś formularz. Nic nie jest zablokowane.

```
diagnose → conceptualize → recall → space → verify → mastered
```

**Biegłość się zdobywa i jest niezależna od medium.** Wejście o poziom wyżej wymaga udowodnionej retencji (przypomnienia pojęcia po rzeczywistej przerwie, a nie tego samego dnia) plus dowodów, które nie są fiszkami - wyjaśnienia go, zastosowania do nowych problemów oraz, dla `expert`, zbudowania czegoś prawdziwego. Rozkładanie w czasie liczy rzeczywiście upływający czas, więc kucie tego samego dnia niczego nie posuwa.

**Sprawdziany są szablonowe, nie improwizowane.** `assess` wydaje zadanie z ustalonego szablonu; ty je zgłaszasz; `evaluate` ocenia je według stałej rubryki, żeby ocena nie dryfowała. Zaliczony `build` to jedyna droga do dowodu wymaganego przez `expert`.

### Model własności

| Obszar | Właściciel | Pliki |
| --- | --- | --- |
| **Wiedza** | piszesz ty, silnik tylko czyta | `subjects/<s>/{audit,notes,roadmap}.md`, `assessments/*.md` |
| **Stan** | należy do silnika, nie edytować ręcznie | `data/learn_it.db` (fiszki, dziennik przypomnień, dowody) |
| **Silnik** | wersjonowana logika + prompty | `src/*.ts`, `stages/*.md`, `templates/*` |

Jedyna zasada: silnik zapisuje *Stan*, czyta *Wiedzę* i nigdy nie edytuje pliku napisanego przez ciebie.

### Silnik

| Plik | Rola |
| --- | --- |
| `src/learn-it.ts` | Router sesji: pulpit, obserwator, pojęcia, fiszki, assess/evaluate, biegłość, notatki, `export`, `doctor`. |
| `src/lifecycle.ts` | Wnioskuje fazę tematu i doradza (nigdy nie blokuje). |
| `src/scheduler.ts` | Rdzeń FSRS dla fiszek; zapisuje każde przypomnienie wobec rzeczywiście upływającego czasu. |
| `src/exposure.ts` | Rozłożona w czasie ekspozycja na poziomie pojęcia (kolejka `reinforce`), posuwana dowolnym sposobem. |
| `src/mastery.ts` | Poziomy Dreyfusa, agregowane po pojęciach + dowodach (ilość nie liczy się do punktów). |
| `src/init-db.ts` | Tworzy / migruje schemat SQLite. |
| `src/dashboard.ts` | Lokalny pulpit webowy bez budowania. |
| `src/telemetry.ts` | Anonimowa, pozbawiona treści telemetria użycia (opt-out). |

Pełny projekt — wraz z diagramem całego przepływu — znajdziesz w [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).

## Telemetria

Learn-it wysyła **anonimową, pozbawioną treści** telemetrię użycia (PostHog), aby narzędzie można było ulepszać na podstawie komend, których ludzie faktycznie używają. Przy pierwszym wysłaniu czegokolwiek wyświetla się wyraźne, jednorazowe powiadomienie.

- **Co wysyła:** uruchomioną komendę (`grade`, `assess`, …), wersję aplikacji, twój system operacyjny oraz losowe id na instalację. Pulpit wysyła wyłącznie anonimowe odsłony stron.
- **Czego nigdy nie wysyła:** nazw przedmiotów, nazw pojęć, treści fiszek, notatek, wyników — *niczego*, czego się uczysz. To zostaje w `data/*.db` na twojej maszynie i nigdy jej nie opuszcza.
- **Wyłącz w dowolnej chwili:** `export DO_NOT_TRACK=1` ([standard międzynarzędziowy](https://consoledonottrack.com)) lub `export LEARN_IT_TELEMETRY=0`. Uruchomienia w CI są wykluczane automatycznie. Anonimowe id znajduje się w `data/.telemetry-id` — usuń je, aby zresetować.

## Podziękowania

Router umiejętności i rusztowanie promptów dla poszczególnych etapów czerpią inspirację z [career-ops](https://github.com/santifer/career-ops) (MIT). Metodologia, silnik harmonogramowania i logika domenowa Learn-it są autorskie.
