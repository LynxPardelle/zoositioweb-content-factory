import argparse
import json
import os
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Render a Zoositioweb pilot video through MoneyPrinterTurbo services."
    )
    parser.add_argument("--mpt-root", required=True)
    parser.add_argument("--source-video", required=True, action="append")
    parser.add_argument("--source-audio", required=True)
    parser.add_argument("--subtitle-file", required=True)
    parser.add_argument("--combined-file", required=True)
    parser.add_argument("--output-file", required=True)
    parser.add_argument("--concat-mode", choices=["sequential", "random"], default="sequential")
    parser.add_argument("--transition", choices=["None", "Shuffle", "FadeIn", "FadeOut", "SlideIn", "SlideOut"], default="None")
    parser.add_argument("--clip-duration", type=int, default=5)
    parser.add_argument("--bgm-type", default="")
    parser.add_argument("--bgm-file", default="")
    parser.add_argument("--bgm-volume", type=float, default=0)
    parser.add_argument("--subtitle-position", choices=["top", "bottom", "center", "custom"], default="bottom")
    parser.add_argument("--custom-position", type=float, default=70)
    parser.add_argument("--font-name", default="MicrosoftYaHeiBold.ttc")
    parser.add_argument("--font-size", type=int, default=60)
    parser.add_argument("--stroke-width", type=int, default=3)
    parser.add_argument("--threads", type=int, default=2)
    return parser.parse_args()


def require_file(path_value, label):
    if not os.path.isfile(path_value):
        raise FileNotFoundError(f"{label} not found: {path_value}")


def main():
    args = parse_args()
    mpt_root = os.path.abspath(args.mpt_root)

    if not os.path.isdir(mpt_root):
        raise FileNotFoundError(f"MoneyPrinterTurbo root not found: {mpt_root}")

    for source_video in args.source_video:
        require_file(source_video, "source video")
    require_file(args.source_audio, "source audio")
    require_file(args.subtitle_file, "subtitle file")

    os.makedirs(os.path.dirname(args.combined_file), exist_ok=True)
    os.makedirs(os.path.dirname(args.output_file), exist_ok=True)
    os.chdir(mpt_root)
    sys.path.insert(0, mpt_root)

    from app.models.schema import (
        VideoAspect,
        VideoConcatMode,
        VideoParams,
        VideoTransitionMode,
    )
    from app.services import video

    concat_mode = VideoConcatMode(args.concat_mode)
    transition_mode = None
    if args.transition != "None":
        transition_mode = VideoTransitionMode(args.transition)

    params = VideoParams(
        video_subject="Zoositioweb pilot",
        video_script="",
        video_aspect=VideoAspect.portrait.value,
        video_concat_mode=concat_mode.value,
        video_transition_mode=transition_mode.value if transition_mode else None,
        video_clip_duration=args.clip_duration,
        video_count=1,
        video_source="local",
        voice_volume=1.0,
        bgm_type=args.bgm_type,
        bgm_file=args.bgm_file,
        bgm_volume=args.bgm_volume,
        subtitle_enabled=True,
        subtitle_position=args.subtitle_position,
        custom_position=args.custom_position,
        font_name=args.font_name,
        text_fore_color="#FFFFFF",
        text_background_color=False,
        font_size=args.font_size,
        stroke_color="#101010",
        stroke_width=args.stroke_width,
        n_threads=args.threads,
    )

    video.combine_videos(
        combined_video_path=args.combined_file,
        video_paths=args.source_video,
        audio_file=args.source_audio,
        video_aspect=VideoAspect.portrait.value,
        video_concat_mode=concat_mode,
        video_transition_mode=transition_mode,
        max_clip_duration=args.clip_duration,
        threads=args.threads,
    )
    video.generate_video(
        video_path=args.combined_file,
        audio_path=args.source_audio,
        subtitle_path=args.subtitle_file,
        output_file=args.output_file,
        params=params,
    )

    print(
        json.dumps(
            {
                "combinedFile": args.combined_file,
                "outputFile": args.output_file,
                "sourceVideos": args.source_video,
                "concatMode": args.concat_mode,
                "transition": args.transition,
                "clipDuration": args.clip_duration,
                "bgmType": args.bgm_type,
                "bgmFile": args.bgm_file,
                "bgmVolume": args.bgm_volume,
                "subtitlePosition": args.subtitle_position,
                "fontName": args.font_name,
                "fontSize": args.font_size,
                "strokeWidth": args.stroke_width,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
