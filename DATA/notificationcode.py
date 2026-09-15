try: Pipeline_Name
except NameError: Pipeline_Name = "Fabric ETL"

try: Status
except NameError: Status = "Succeeded"

try: Config_Name
except NameError: Config_Name = "Fabric Pipeline"

try: Source_System
except NameError: Source_System = "Unknown"

try: Target_Name
except NameError: Target_Name = "ALL"

try: Environment_Name
except NameError: Environment_Name = "BHG-DATA-PLATFORM-CORE-DEV"

try:
    Task_Config_Id
except NameError:
    Task_Config_Id = ""

try:
    Bronze_Rows
except NameError:
    Bronze_Rows = 0

try:
    Silver_Rows
except NameError:
    Silver_Rows = 0

try:
    Gold_Rows
except NameError:
    Gold_Rows = 0

try:
    Sites_Processed
except NameError:
    Sites_Processed = 0

try:
    Success_Count
except NameError:
    Success_Count = 1

try: Run_Id
except NameError: Run_Id = ""

try: Description
except NameError: Description = ""

try: Error_Msg
except NameError: Error_Msg = ""

try: Pipeline_StartTime
except NameError: Pipeline_StartTime = ""

try: Pipeline_EndTime
except NameError: Pipeline_EndTime = ""

try: Teams_Webhook_Url
except NameError:
    Teams_Webhook_Url = "https://defaulta5fa28cad2e54dca931f1b594b88e7.e7.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/67e2fd2b059d45e5b39571a7e2df9dc2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=qTzglKXyn21I2PYeb-PgRdDWspqn9Taryecku4YECtg"

# ETL Ops Dashboard dual-write (failures only). Set in notebook params or leave default for local API.
try: Ops_Ingest_Url
except NameError:
    Ops_Ingest_Url = "http://127.0.0.1:8000/api/notifications/ingest"

try: Ops_Ingest_Api_Key
except NameError:
    Ops_Ingest_Api_Key = ""

from datetime import datetime, timezone
import requests

try:
    from zoneinfo import ZoneInfo
    CENTRAL_TZ = ZoneInfo("America/Chicago")
except Exception:
    CENTRAL_TZ = None


def central_now_text():
    if CENTRAL_TZ:
        return datetime.now(CENTRAL_TZ).strftime("%Y-%m-%d %H:%M:%S")
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def truncate_iso_fraction(value):
    if "." not in value:
        return value

    head, tail = value.split(".", 1)
    suffix = ""

    if "+" in tail:
        fraction, offset = tail.split("+", 1)
        suffix = "+" + offset
    elif "-" in tail:
        fraction, offset = tail.split("-", 1)
        suffix = "-" + offset
    else:
        fraction = tail

    return head + "." + fraction[:6] + suffix


def central_datetime_text(value):
    text = str(value or "").strip()

    if not text or not CENTRAL_TZ:
        return text

    has_timezone = (
        text.endswith("Z")
        or (len(text) >= 6 and text[-6] in ["+", "-"] and text[-3] == ":")
    )

    if not has_timezone:
        return text

    try:
        candidate = truncate_iso_fraction(text.replace("Z", "+00:00"))
        parsed_dt = datetime.fromisoformat(candidate)

        if parsed_dt.tzinfo is None:
            parsed_dt = parsed_dt.replace(tzinfo=timezone.utc)

        return parsed_dt.astimezone(CENTRAL_TZ).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return text


def clean_text(value):
    if value is None:
        return ""

    text = str(value)

    for marker in ["at com.microsoft", "at py4j"]:
        if marker in text:
            text = text.split(marker)[0]

    text = (
        text
        .replace("|", " ")
        .replace("\n", " ")
        .replace("\r", " ")
        .replace("java.base", " ")
    )

    return " ".join(text.split())


def target_layer_name(target_name):
    target_layer_map = {
        "BR": "Bronze",
        "SL": "Silver",
        "GL": "Gold",
        "ALL": "Bronze/Silver/Gold"
    }

    return target_layer_map.get(
        str(target_name).upper(),
        str(target_name)
    )


def display_config_name(config_name):
    return (
        str(config_name or "")
        .replace(" Pipeline", "")
        .replace(" pipeline", "")
    )


def post_teams_message(payload):
    print(f"Teams Notification Payload Summary : {payload.get('summary', '')}")
    print(f"Teams Notification Payload Title : {payload.get('title', '')}")

    response = requests.post(
        Teams_Webhook_Url,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=30
    )

    print(f"Teams Notification Status : {response.status_code}")

    tracking_headers = {
        key: response.headers.get(key)
        for key in [
            "x-ms-workflow-run-id",
            "x-ms-correlation-id",
            "x-ms-client-tracking-id",
            "x-ms-request-id"
        ]
        if response.headers.get(key)
    }

    if tracking_headers:
        print(f"Teams Notification Tracking Headers : {tracking_headers}")

    if response.text:
        print(f"Teams Notification Response Body : {response.text[:2000]}")

    if response.status_code >= 400:
        print(response.text[:2000])
        response.raise_for_status()


def post_ops_dashboard_failure(ops_payload):
    """Dual-write failure alert into ETL Operations Center (does not replace Teams)."""
    url = str(Ops_Ingest_Url or "").strip()
    if not url:
        print("Ops Dashboard ingest skipped : Ops_Ingest_Url is empty")
        return

    headers = {"Content-Type": "application/json"}
    api_key = str(Ops_Ingest_Api_Key or "").strip()
    if api_key:
        headers["X-API-Key"] = api_key

    try:
        response = requests.post(url, json=ops_payload, headers=headers, timeout=15)
        print(f"Ops Dashboard ingest status : {response.status_code} body={response.text[:500]}")
    except Exception as exc:
        # Never fail the Fabric notebook because dashboard ingest failed
        print(f"Ops Dashboard ingest error (ignored) : {exc}")


def send_teams_failure_alert(
    pipeline_name,
    config_name,
    source_system,
    target_name,
    environment_name,
    run_id,
    failed_count,
    failures
):
    target_layer = target_layer_name(target_name)
    failure_text = ""

    if failures:
        for idx, failure in enumerate(failures, start=1):
            failure_text += f"""

Failure {idx}

Task Config ID : {failure.get('task_config_id', '')}

Task Name : {failure.get('task', '')}

Error :
{failure.get('error', '')}

--------------------------------------------------

"""
    else:
        failure_text = clean_text(Error_Msg) or clean_text(Description) or "Pipeline failed. Review Fabric run history and audit tables for details."

    payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "FF0000",
        "summary": f"Pipeline Failed - {pipeline_name}",
        "title": (
            f"{environment_name}: Failed - "
            f"{source_system} - "
            f"{target_layer} - "
            f"{central_now_text()}"
        ),
        "sections": [
            {
                "facts": [
                    {"name": "Pipeline:", "value": str(pipeline_name)},
                    {"name": "Config Name:", "value": display_config_name(config_name)},
                    {"name": "Run ID:", "value": str(run_id)},
                    {"name": "Layer:", "value": target_layer},
                    {"name": "Failed Tasks:", "value": str(failed_count)},
                    {"name": "Start Time:", "value": central_datetime_text(Pipeline_StartTime)},
                    {"name": "End Time:", "value": central_datetime_text(Pipeline_EndTime)}
                ]
            },
            {
                "activityTitle": "Failure Details",
                "text": failure_text[:12000]
            }
        ]
    }

    post_teams_message(payload)

    # Dual-write into ETL Operations Center (Teams remains primary)
    post_ops_dashboard_failure({
        "status": "FAILED",
        "pipeline_name": str(pipeline_name),
        "config_name": str(config_name),
        "source_system": str(source_system),
        "target_name": str(target_name),
        "environment_name": str(environment_name),
        "run_id": str(run_id),
        "pipeline_run_id": str(run_id) if "-" in str(run_id) else "",
        "failed_count": int(failed_count or 0),
        "start_time": str(Pipeline_StartTime or ""),
        "end_time": str(Pipeline_EndTime or ""),
        "error_summary": clean_text(Error_Msg)[:3000] or clean_text(Description)[:3000],
        "failure_details": failure_text[:12000],
        "title": payload.get("title"),
        "summary": payload.get("summary"),
        "source": "teams_webhook",
    })


def send_teams_success_alert(
    pipeline_name,
    config_name,
    source_system,
    target_name,
    environment_name,
    run_id,
    success_count
):
    target_layer = target_layer_name(target_name)

    payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "00AA00",
        "summary": f"Pipeline Succeeded - {pipeline_name}",
        "title": (
            f"{environment_name}: Succeeded - "
            f"{source_system} - "
            f"{target_layer} - "
            f"{central_now_text()}"
        ),
        "sections": [
            {
                "facts": [
                    {"name": "Pipeline:", "value": str(pipeline_name)},
                    {"name": "Config Name:", "value": display_config_name(config_name)},
                    {"name": "Run ID:", "value": str(run_id)},
                    {"name": "Layer:", "value": target_layer},
                    {"name": "Successful Tasks:", "value": str(success_count)},
                    {"name": "Start Time:", "value": central_datetime_text(Pipeline_StartTime)},
                    {"name": "End Time:", "value": central_datetime_text(Pipeline_EndTime)}
                ]
            },
            {
                "activityTitle": "Pipeline Details",
                "text": f"""
            {clean_text(Description)}
            
            Bronze Rows : {Bronze_Rows}
            Silver Rows : {Silver_Rows}
            Gold Rows : {Gold_Rows}
            Sites Processed : {Sites_Processed}
            """[:12000]
            }
        ]
    }

    post_teams_message(payload)


def fabric_task():
    pipeline_name = Pipeline_Name or "Fabric ETL"
    pipeline_status = str(Status or "Failed")
    run_id = Run_Id or ""
    normalized_status = pipeline_status.strip().upper()

    if normalized_status in ("FAILED", "FAILURE", "ERROR"):
        failures = [{
            "task": Description or pipeline_name,
            "task_config_id": Task_Config_Id,
            "error": clean_text(Error_Msg)[:3000]
        }]

        send_teams_failure_alert(
            pipeline_name=pipeline_name,
            config_name=Config_Name,
            source_system=Source_System,
            target_name=Target_Name,
            environment_name=Environment_Name,
            run_id=run_id,
            failed_count=1,
            failures=failures
        )
    else:
        send_teams_success_alert(
            pipeline_name=pipeline_name,
            config_name=Config_Name,
            source_system=Source_System,
            target_name=Target_Name,
            environment_name=Environment_Name,
            run_id=run_id,
            success_count=Success_Count
        )


fabric_task()
