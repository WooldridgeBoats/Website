#!/usr/bin/perl
# Build the "PHOTO PATHWAYS" drag-and-drop staging tree for the media team,
# plus a machine-readable map (_photo-pathways.json) so the site can be
# repointed at it automatically once populated.
# All folder names are ALL CAPS by design (media team request, 2026-07-08).
use strict; use warnings; use utf8;
use File::Path qw(make_path);
use JSON::PP;

my $SITE = 'C:/Users/steph/Desktop/WB-BETA-V4/ALMOST DONE';
my $ROOT = "$SITE/PHOTO PATHWAYS";

# slug, display name, category, [lengths]   (order = website section order)
my @MODELS = (
  ['alaskan-lt',              'Alaskan LT',                 'Outboard Jet', [16,18,20]],
  ['alaskan',                 'Alaskan',                    'Outboard Jet', [18,20]],
  ['alaskan-xlt',             'Alaskan XLT',                'Outboard Jet', [18,20]],
  ['alaskanxl',               'Alaskan XL',                 'Outboard Jet', [20]],
  ['rogue',                   'Rogue HDPE',                 'Outboard Jet', [16,18,20]],
  ['skagit',                  'Skagit',                     'Outboard Jet', [18,20]],
  ['sport',                   'Sport',                      'Outboard Jet', [18,20]],
  ['supersportdrifter',       'Super Sport Drifter',        'Outboard Jet', [21,23,25]],
  ['sportster',               'Sportster',                  'Outboard Jet', [21,23,25]],
  ['alaskan-xl-inboard',      'Alaskan XL Inboard',         'Inboard Jet',  [20,21]],
  ['scout',                   'Scout',                      'Inboard Jet',  [19,21,23]],
  ['scout-widebody',          'Scout Widebody',             'Inboard Jet',  [21,23,25]],
  ['skagit-inboard',          'Skagit Inboard',             'Inboard Jet',  [18,20]],
  ['sportinboard',            'Sport Inboard',              'Inboard Jet',  [18,20]],
  ['supersportdrifterinboard','Super Sport Drifter Inboard','Inboard Jet',  [20,23,25]],
  ['skagit-x',                'Skagit-X',                   'Inboard Jet',  [21]],
  ['sportoffshore',           'Sport Offshore',             'Offshore',     [18,20]],
  ['super-sport-offshore',    'Super Sport Offshore',       'Offshore',     [20,21,23,26]],
  ['landing-craft',           'Landing Craft',              'Specialty Workboat', []],
  ['agency-lc29',             'LC 29',                      'Agency Build', [29]],
);

# category (from model list) -> top-level group folder (numbered for sort order)
my %CATFOLDER = (
  'Outboard Jet'       => '1 - OUTBOARDS',
  'Inboard Jet'        => '2 - INBOARDS',
  'Offshore'           => '3 - OFFSHORE',
  'Specialty Workboat' => '4 - OTHER BUILDS',
  'Agency Build'       => '4 - OTHER BUILDS',
);

my @ROLE_LEN = map { uc } ('1 - hero (choose 1)', '2 - featured (choose 3-8)', '3 - fluff - everything else');
my $CARDDIR  = uc('00 - MODEL CARD and HERO');
my @ROLE_MOD = map { uc } ('card thumbnail (choose 1)', 'model hero (choose 1)');

make_path($ROOT);
my (@map, $folders);

my %catnum;   # per-category running index
for my $M (@MODELS) {
  my ($slug, $name, $cat, $lens) = @$M;
  my $catfolder = $CATFOLDER{$cat} or die "no category folder for '$cat'";
  my $i = ++$catnum{$catfolder};
  my $lenlabel = @$lens ? join(', ', @$lens) . ' ft' : 'sizes vary';
  my $mfolder = uc(sprintf('%02d - %s - %s', $i, $name, $lenlabel));
  my $mpath = "$ROOT/$catfolder/$mfolder";

  # model-wide card + hero
  for my $r (@ROLE_MOD) { make_path("$mpath/$CARDDIR/$r"); $folders++; }

  my %lenmap;
  my @lenkeys = @$lens ? @$lens : ('general');
  for my $L (@lenkeys) {
    my $lfolder = uc($L eq 'general' ? 'general - all sizes' : "$L ft");
    $lenmap{$L} = $lfolder;
    for my $r (@ROLE_LEN) { make_path("$mpath/$lfolder/$r"); $folders++; }
  }

  push @map, {
    slug => $slug, name => $name, cat => $cat,
    categoryFolder => $catfolder,
    folder => $mfolder,
    path => "$catfolder/$mfolder",
    lengths => (@$lens ? [ map { 0 + $_ } @$lens ] : []),
    modelWide => { folder => $CARDDIR, card => $ROLE_MOD[0], hero => $ROLE_MOD[1] },
    lengthFolders => \%lenmap,
    roles => { hero => $ROLE_LEN[0], featured => $ROLE_LEN[1], fluff => $ROLE_LEN[2] },
  };
}

# ---- machine-readable map ----------------------------------------------------
my $meta = {
  generated => '2026-07-08',
  purpose   => 'Drag-and-drop photo staging. Populate, then repoint the website at it.',
  siteRoot  => 'ALMOST DONE',
  roleLabels => {
    card => 'Fleet-grid card image for the model (choose 1)',
    modelHero => 'Banner at top of the model page (choose 1)',
    hero => 'Lead image for this length section (choose 1)',
    featured => 'Hand-picked highlights, shown first/large',
    fluff => 'Everything else worth showing',
  },
  models => \@map,
};
open my $j, '>:encoding(UTF-8)', "$ROOT/_photo-pathways.json" or die $!;
print $j JSON::PP->new->canonical->pretty->encode($meta);
close $j;

print "created $folders leaf folders across ${\ scalar @MODELS} models\n";
print "root: $ROOT\n";
