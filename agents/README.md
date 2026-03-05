# Agent/Sub-agent 구성

이 폴더는 네이버 카페 숙제 자동화 시스템의 역할 분리를 정의합니다.

- 오케스트레이터: `homework-orchestrator`
- 수집: `cafe-collector-agent`
- 파싱: `homework-parser-agent`
- 퍼블리시: `html-publisher-agent`
- 운영: `schedule-ops-agent`

상세 매핑은 `system-topology.yaml`을 기준으로 유지합니다.
