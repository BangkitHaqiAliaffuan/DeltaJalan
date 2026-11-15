<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class InspectionSession extends Model
{
    use HasUuids;
    protected $fillable = ['survey_task_id','patrol_schedule_id','team_id','started_by','schedule_type','status','started_at','submitted_at','idempotency_key','request_fingerprint'];
    protected $casts = ['started_at'=>'datetime','submitted_at'=>'datetime'];
    public function assignments() { return $this->hasMany(SurveyTaskReport::class); }
    public function team() { return $this->belongsTo(Team::class); }
    public function task() { return $this->belongsTo(SurveyTask::class, 'survey_task_id'); }
}
