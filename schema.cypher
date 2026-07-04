// ============================================================
// Схема графа знаний (Neo4j 5)
//
// Узлы:
//   Material    {name*, class, aliases[]}   // name — каноническое (нормализованное) имя, aliases — варианты из текстов
//   Process     {name*, type, description}
//   Equipment   {name*, model, manufacturer, type}
//   Property    {uid*, text, parameter?, value?, unit?}          // утверждение из текста как есть; uid = hash(text).
//                                                                // Обязателен только text. parameter/value/unit — опциональная
//                                                                // структуризация вторым LLM-проходом (для числовых выборок);
//                                                                // text никогда не перезаписывается.
//   Experiment  {uid*, name, date, scale, description}          // scale: lab | pilot | industrial
//   Publication {uid*, doi, title, year, source_type, country,  // source_type: article | patent | report | thesis | conference
//                language, venue, url, summary, embedding[]}    // summary и embedding заполняются LLM-пайплайном (enrich_publications.py)
//   Expert      {name*, affiliation, orcid}
//   Facility    {name*, city, country, type}
//   Chunk       {uid*, text, embedding[]}                        // фрагмент текста публикации для векторного RAG
//
// Связи (основные, из вашего списка):
//   (Process|Experiment)          -[:USES_MATERIAL]->            (Material)
//   (Equipment|Process|Experiment)-[:OPERATES_AT_CONDITION]->   (Property)   // условие/режим — это Property-утверждение
//   (Process|Experiment)          -[:PRODUCES_OUTPUT]->          (Material)
//   (любой узел)                  -[:DESCRIBED_IN {quote,page}]->(Publication)   // провенанс каждого факта
//   (Property|Process)            -[:VALIDATED_BY]->             (Experiment|Expert)
//   (Publication|Property)        -[:CONTRADICTS {aspect,note}]->(Publication|Property)
//
// Служебные связи (без них граф не связывается):
//   (Material)   -[:HAS_PROPERTY]->   (Property)
//   (Expert)     -[:AUTHORED]->       (Publication)
//   (Expert)     -[:AFFILIATED_WITH]->(Facility)
//   (Experiment) -[:CONDUCTED_AT]->   (Facility)
//   (Publication)-[:HAS_CHUNK]->      (Chunk)
//
// * — уникальный ключ (constraint ниже)
// ============================================================

// --- Уникальность (ключи для MERGE при пополнении) ---
CREATE CONSTRAINT material_name    IF NOT EXISTS FOR (n:Material)    REQUIRE n.name IS UNIQUE;
CREATE CONSTRAINT process_name     IF NOT EXISTS FOR (n:Process)     REQUIRE n.name IS UNIQUE;
CREATE CONSTRAINT equipment_name   IF NOT EXISTS FOR (n:Equipment)   REQUIRE n.name IS UNIQUE;
CREATE CONSTRAINT property_uid     IF NOT EXISTS FOR (n:Property)    REQUIRE n.uid  IS UNIQUE;
CREATE CONSTRAINT experiment_uid   IF NOT EXISTS FOR (n:Experiment)  REQUIRE n.uid  IS UNIQUE;
CREATE CONSTRAINT publication_uid  IF NOT EXISTS FOR (n:Publication) REQUIRE n.uid  IS UNIQUE;
CREATE CONSTRAINT expert_name      IF NOT EXISTS FOR (n:Expert)      REQUIRE n.name IS UNIQUE;
CREATE CONSTRAINT facility_name    IF NOT EXISTS FOR (n:Facility)    REQUIRE n.name IS UNIQUE;
CREATE CONSTRAINT chunk_uid        IF NOT EXISTS FOR (n:Chunk)       REQUIRE n.uid  IS UNIQUE;

// NB: existence-констрейнты (REQUIRE ... IS NOT NULL) требуют Enterprise Edition —
// в Community обязательность title/year/source_type контролируем в коде загрузки.

// --- Индексы для группировок источников ---
CREATE INDEX publication_year        IF NOT EXISTS FOR (n:Publication) ON (n.year);
CREATE INDEX publication_source_type IF NOT EXISTS FOR (n:Publication) ON (n.source_type);
CREATE INDEX publication_country     IF NOT EXISTS FOR (n:Publication) ON (n.country);
CREATE INDEX experiment_date         IF NOT EXISTS FOR (n:Experiment)  ON (n.date);

// --- Полнотекстовый поиск по именам сущностей (для entity linking после лемматизации) ---
CREATE FULLTEXT INDEX entity_names IF NOT EXISTS
FOR (n:Material|Process|Equipment|Property|Expert|Facility) ON EACH [n.name];

// --- Векторные индексы для RAG ---
// Размерность подгоните под вашу модель эмбеддингов (1024 — voyage-3 / multilingual-e5-large)
CREATE VECTOR INDEX publication_embedding IF NOT EXISTS
FOR (n:Publication) ON (n.embedding)
OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: 'cosine'}};

CREATE VECTOR INDEX chunk_embedding IF NOT EXISTS
FOR (n:Chunk) ON (n.embedding)
OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: 'cosine'}};
