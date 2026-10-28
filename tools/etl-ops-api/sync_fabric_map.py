import subprocess
import json
import urllib.request
from pathlib import Path
from app.db.sqlite import get_connection

ALIASES = {
    "pl_inv": "pl_inventory",
    "pl_execute_samms_global": "pl_execute_samms_global_src_to_bz",
    "nb_p1_finance_bronze_to_silver": "pl_p1_finance_bronze_to_silver",
    "execute_p1_finance": "pl_p1_finance",
    "pl_execute_reference": "pl_reference",
    "nb_p1_reference_bronze_to_silver": "pl_reference_bronz_to_silver",
    "execute_p1_reference": "pl_reference",
    "pl_execute_forms": "pl_forms_samms_to_lakehouse",
    "pl_execute_clinical": "pl_clinicalp1/p2_src_to_brz",
    "pl_p1p2_assessments": "pl_p1p2_assessments_copy1",
    "pl_execute_assessments_02": "pl_assessments_02",
    "nb_overduecourses_slv_to_gld": "pl_overduecourses_onedrive",
    "nb_callback_brz_to_slv": "pl_callbacklists",
    "pl_clinical_ua_cdc_src_to_bronze": "pl_clinical_cdc",
    "pl_clinical_ua_cdc_brz_to_slv": "pl_clinical_cdc",
    "pl_execute_notes": "pl_notes",
    "pl_execute_dartsrv": "pl_execute_dartsrv_copy2",
    "pl_execute_pipeline_answersignature": "pl_forms",
    "pl_execute_form_questionanswers": "pl_forms"
}

def sync_fabric_map():
    res = subprocess.run(
        "az account get-access-token --resource https://api.fabric.microsoft.com",
        shell=True, capture_output=True, text=True, check=True
    )
    token = json.loads(res.stdout)["accessToken"]
    ws = "c5097ffb-b78e-441d-9575-a82bac23cac8"
    
    url = f"https://api.fabric.microsoft.com/v1/workspaces/{ws}/items"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resp:
        items = json.loads(resp.read().decode())["value"]

    fabric_by_name = {i["displayName"].strip().lower(): i for i in items}
    
    conn = get_connection()
    configs = conn.execute("SELECT DISTINCT ConfigId, ConfigName, PipelineName FROM etlconfig ORDER BY CAST(ConfigId AS INTEGER)").fetchall()
    
    pipelines_by_config_id = {}
    pipelines_by_pipeline_name = {}
    pipelines_by_config_name = {}
    
    for c in configs:
        cid = str(c["ConfigId"])
        pname_orig = (c["PipelineName"] or "").strip()
        cname_orig = (c["ConfigName"] or "").strip()
        pname = pname_orig.lower()
        cname = cname_orig.lower()
        
        found = fabric_by_name.get(pname) or fabric_by_name.get(cname)
        if not found and pname in ALIASES:
            found = fabric_by_name.get(ALIASES[pname].lower())
            
        if found:
            artifact_id = found["id"]
            pipelines_by_config_id[cid] = artifact_id
            if pname_orig:
                pipelines_by_pipeline_name[pname_orig] = artifact_id
            if cname_orig:
                pipelines_by_config_name[cname_orig] = artifact_id

    output = {
        "workspaceId": ws,
        "experience": "fabric-developer",
        "_comment": "Auto-generated dynamically from Microsoft Fabric REST API.",
        "pipelinesByConfigId": pipelines_by_config_id,
        "pipelinesByPipelineName": pipelines_by_pipeline_name,
        "pipelinesByConfigName": pipelines_by_config_name,
    }

    map_path = Path(__file__).resolve().parents[2] / "DATA" / "fabric_pipeline_map.json"
    with open(map_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Successfully mapped {len(pipelines_by_config_id)} pipelines to {map_path}!")

if __name__ == "__main__":
    sync_fabric_map()
